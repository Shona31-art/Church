"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { assignableRoles, can, canEditMemberRole } from "@/lib/permissions";
import { memberCreateSchema, memberUpdateSchema } from "@/lib/member-schemas";
import { passwordSchema } from "@/lib/account-schemas";
import { FormState, SESSION_EXPIRED, formValues, invalid, optionalField } from "@/lib/forms";
import { AVATAR_BUCKET } from "@/lib/avatar-path";
import { getMemberLimitStatus } from "@/lib/member-limit";
import { RESTRICTION_DURATIONS, RESTRICTION_KINDS, restrictionUntil, type RestrictionDuration, type RestrictionKind } from "@/lib/chat";
import { CHAT_MEDIA_BUCKET } from "@/lib/chat";

// Every member mutation. Each action re-checks who's asking (server actions
// are public endpoints), validates input with Zod, and is backed by the
// database's own rules (security_fix_app_users.sql trigger + RLS).

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const uuid = z.string().uuid();

async function requireMemberManager(): Promise<AppUser | null> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "manageMembers")) return null;
  const access = await checkModuleAccess("members");
  return access.allowed ? me : null;
}

async function loadMember(memberId: string, churchId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, name, email, role, status, church_id, department_id, updated_at")
    .eq("id", memberId)
    .eq("church_id", churchId)
    .maybeSingle();
  return data;
}

async function departmentBelongsToChurch(departmentId: string | null, churchId: string) {
  if (!departmentId) return true;
  const { data } = await createClient().from("departments").select("id").eq("id", departmentId).eq("church_id", churchId).maybeSingle();
  return Boolean(data);
}

/**
 * Add member: creates their login (with the password the admin chose, no
 * email sent) and church profile.
 * Form fields: name, email, phone?, role, department_id?, password
 */
export async function createMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: "Only pastors and church admins can add members. If you are one, sign in again." };
  if (formData.get("record_only") === "on") return createRecordMember(me, formData);

  const parsed = memberCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: optionalField(formData, "phone"),
    role: formData.get("role"),
    departmentId: formData.get("department_id") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    if (result?.values) delete result.values.password; // never echo a password back
    return result;
  }
  const input = parsed.data;
  const values = formValues(formData);
  delete values.password;

  // The service-role client below bypasses RLS, so every rule the database
  // would enforce is checked here first.
  if (!assignableRoles(me.role).includes(input.role)) {
    return { error: "You can't give someone that role.", fieldErrors: { role: "Only a church admin can add another church admin." }, values };
  }
  if (input.role === "department_leader" && !input.departmentId) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { department_id: "Choose the department they lead." }, values };
  }
  if (!(await departmentBelongsToChurch(input.departmentId, me.church_id!))) {
    return { error: "That department couldn't be found — refresh and try again.", values };
  }
  const limit = await getMemberLimitStatus(me.church_id!);
  if (limit.reached) {
    return {
      error: `Your plan allows ${limit.limit} active members and you've reached it. Deactivate someone who has left, or a church admin can upgrade from Billing.`,
      values,
    };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("app_users").select("church_id").eq("email", input.email).maybeSingle();
  if (existing) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        email: existing.church_id === me.church_id ? "This person is already in your member list." : "This email already has an account with another church.",
      },
      values,
    };
  }

  // The admin sets the first password, so no email is sent. The member is
  // asked to choose their own password the first time they sign in.
  const { data: invited, error: inviteError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, must_change_password: true },
  });
  if (inviteError || !invited.user) {
    console.error("[members] create login failed:", inviteError?.message);
    const already = /already|registered|exists/i.test(inviteError?.message ?? "");
    const weak = /password/i.test(inviteError?.message ?? "");
    return {
      error: already
        ? "That email already has a login. Ask platform support to link it to your church."
        : weak
        ? "Supabase rejected that password. Try a longer one with letters, numbers and a symbol."
        : "We couldn't create their login. Check the address and try again in a minute.",
      fieldErrors: weak ? { password: "Choose a stronger password." } : undefined,
      values,
    };
  }

  const { data: created, error: insertError } = await admin
    .from("app_users")
    .insert({
      id: invited.user.id,
      church_id: me.church_id,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      role: input.role,
      department_id: input.departmentId,
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("[members] profile insert failed:", insertError?.message);
    // Don't leave a login with no profile behind.
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: "We couldn't create the member profile, so their login was removed again. Please try again.", values };
  }

  await saveNewBirthday(created.id, me, formData);
  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: "member.created",
    targetTable: "app_users",
    targetId: created.id,
    metadata: { role: input.role },
  });

  revalidatePath("/dashboard/members");
  flash(`${input.name} was added. Share their email and password with them so they can sign in.`);
  redirect(`/dashboard/members/${created.id}`);
}

/**
 * Edit member profile. Form fields: member_id, updated_at, name, phone?,
 * role, department_id?, birth_date?
 *
 * `updated_at` is the version the editor loaded: if someone else saved in the
 * meantime, the update matches no rows and we say so instead of overwriting.
 */
export async function updateMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = memberUpdateSchema.safeParse({
    memberId: formData.get("member_id"),
    updatedAt: formData.get("updated_at"),
    name: formData.get("name"),
    phone: optionalField(formData, "phone"),
    role: formData.get("role"),
    departmentId: formData.get("department_id") ?? "",
    birthDate: formData.get("birth_date") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const input = parsed.data;
  const values = formValues(formData);

  const target = await loadMember(input.memberId, me.church_id!);
  if (!target) return { error: "That member couldn't be found in your church." };
  if (target.role === "church_admin" && me.role !== "church_admin") {
    return { error: "Only a church admin can edit another church admin's profile." };
  }

  const roleChanged = input.role !== target.role;
  const departmentChanged = input.departmentId !== target.department_id;
  if ((roleChanged || departmentChanged) && !canEditMemberRole(me, target)) {
    return {
      error:
        target.id === me.id
          ? "You can't change your own role or department — ask another church admin."
          : "Only a church admin can change a church admin's role or department.",
      values,
    };
  }
  if (roleChanged && !assignableRoles(me.role).includes(input.role)) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { role: "Only a church admin can grant the church admin role." }, values };
  }
  if (input.role === "department_leader" && !input.departmentId) {
    return { error: "Please fix the highlighted fields.", fieldErrors: { department_id: "Choose the department they lead." }, values };
  }
  if (!(await departmentBelongsToChurch(input.departmentId, me.church_id!))) {
    return { error: "That department couldn't be found — refresh and try again.", values };
  }

  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from("app_users")
    .update({ name: input.name, phone: input.phone ?? null, role: input.role, department_id: input.departmentId })
    .eq("id", input.memberId)
    .eq("church_id", me.church_id)
    .eq("updated_at", input.updatedAt)
    .select("id");
  if (error) {
    console.error("[members] update failed:", error.message);
    return { error: "Couldn't save the changes — please try again.", values };
  }
  if (!updated?.length) {
    return { error: "Someone else changed this member while you were editing. Reload the page to see their changes, then try again.", values };
  }

  const bdayRow = { user_id: input.memberId, church_id: me.church_id, birth_date: input.birthDate, updated_by: me.id };
  let { error: bdayError } = input.birthDate
    ? await supabase.from("member_birthdays").upsert({ ...bdayRow, announce: formData.get("birthday_announce") === "on" })
    : await supabase.from("member_birthdays").delete().eq("user_id", input.memberId);
  // Before record_members.sql (#63): save without the "tell the church" choice.
  if (bdayError && input.birthDate && /announce/.test(bdayError.message)) ({ error: bdayError } = await supabase.from("member_birthdays").upsert(bdayRow));
  if (bdayError) {
    console.error("[members] birthday save failed:", bdayError.message);
    flash("Profile saved, but the birthday couldn't be updated — try again.", "error");
    redirect(`/dashboard/members/${input.memberId}`);
  }

  if (roleChanged || departmentChanged) {
    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: "member.role_changed",
      targetTable: "app_users",
      targetId: input.memberId,
      metadata: { from: { role: target.role, department_id: target.department_id }, to: { role: input.role, department_id: input.departmentId } },
    });
  }

  revalidatePath("/dashboard/members");
  revalidatePath(`/dashboard/members/${input.memberId}`);
  flash("Changes saved.");
  redirect(`/dashboard/members/${input.memberId}`);
}

/** Form fields: member_id, to ("disabled" | "active"). Deactivate keeps every record; reactivate restores access. */
export async function setMemberStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: SESSION_EXPIRED };

  const memberId = uuid.safeParse(formData.get("member_id"));
  const to = z.enum(["disabled", "active"]).safeParse(formData.get("to"));
  if (!memberId.success || !to.success) return { error: "That action isn't valid." };

  const target = await loadMember(memberId.data, me.church_id!);
  if (!target) return { error: "That member couldn't be found in your church." };
  if (!canEditMemberRole(me, target)) {
    return { error: target.id === me.id ? "You can't deactivate your own account." : "Only a church admin can change a church admin's access." };
  }
  if (to.data === "active") {
    const limit = await getMemberLimitStatus(me.church_id!);
    if (limit.reached) return { error: `Your plan allows ${limit.limit} active members. Upgrade or deactivate someone else first.` };
  }

  // Reactivating someone who never accepted their invite puts them back to "invited".
  const { data: auth } = to.data === "active" ? await createAdminClient().auth.admin.getUserById(target.id) : { data: null };
  const newStatus = to.data === "active" && !auth?.user?.last_sign_in_at ? "invited" : to.data;

  const supabase = createClient();
  const { error } = await supabase.from("app_users").update({ status: newStatus }).eq("id", target.id).eq("church_id", me.church_id);
  if (error) {
    console.error("[members] status change failed:", error.message);
    return { error: "Couldn't change their access — please try again." };
  }

  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: to.data === "disabled" ? "member.deactivated" : "member.reactivated",
    targetTable: "app_users",
    targetId: target.id,
  });

  revalidatePath("/dashboard/members");
  revalidatePath(`/dashboard/members/${target.id}`);
  flash(to.data === "disabled" ? `${target.name} was deactivated. Their records are kept.` : `${target.name} can sign in again.`);
  return { ok: true };
}

/** Form fields: member_id. Sends a fresh "set your password" email to someone who hasn't signed in yet. */
export async function resendInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: SESSION_EXPIRED };
  const memberId = uuid.safeParse(formData.get("member_id"));
  if (!memberId.success) return { error: "That member couldn't be found." };

  const target = await loadMember(memberId.data, me.church_id!);
  if (!target) return { error: "That member couldn't be found in your church." };
  if (target.status !== "invited") return { error: "This person has already accepted their invite." };

  // A recovery link works for invited users too: it lets them choose a password.
  const { error } = await createAdminClient().auth.resetPasswordForEmail(target.email, {
    redirectTo: new URL("/reset-password", APP_URL).toString(),
  });
  if (error) {
    console.error("[members] resend invite failed:", error.message);
    return {
      error: /rate|seconds/i.test(error.message)
        ? "An email was sent very recently. Please wait a minute before sending another."
        : "We couldn't send the email — please try again shortly.",
    };
  }
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.invite_resent", targetTable: "app_users", targetId: target.id });
  return { ok: true };
}

/**
 * Form fields: member_id, password. A pastor or church admin sets a new
 * temporary password for someone who forgot theirs (no email involved). They
 * are asked to change it the next time they sign in.
 */
export async function setMemberPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: SESSION_EXPIRED };
  const memberId = uuid.safeParse(formData.get("member_id"));
  if (!memberId.success) return { error: "That member couldn't be found." };
  if (memberId.data === me.id) return { error: "Change your own password in My account." };
  const password = passwordSchema.safeParse(formData.get("password") ?? "");
  if (!password.success) return { error: "Please fix the highlighted field.", fieldErrors: { password: password.error.issues[0]?.message ?? "Choose a stronger password." } };

  const target = await loadMember(memberId.data, me.church_id!);
  if (!target) return { error: "That member couldn't be found in your church." };
  // Same rule as roles: only a church admin may touch another church admin's login.
  if (target.role === "church_admin" && me.role !== "church_admin") {
    return { error: "Only a church admin can reset another church admin's password." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(target.id);
  const { error } = await admin.auth.admin.updateUserById(target.id, {
    password: password.data,
    user_metadata: { ...(existing?.user?.user_metadata ?? {}), must_change_password: true },
  });
  if (error) {
    console.error("[members] set password failed:", error.message);
    return { error: "Couldn't set the new password — please try again." };
  }
  if (target.status === "invited") await admin.from("app_users").update({ status: "active" }).eq("id", target.id);
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.password_set", targetTable: "app_users", targetId: target.id });
  revalidatePath(`/dashboard/members/${target.id}`);
  return { ok: true };
}

/**
 * Permanent deletion / POPIA erasure. Church admin only. Removes the login,
 * the profile, and (via ON DELETE rules) the person's own data; giving
 * records are kept for financial retention but de-identified. Care notes that
 * reference the person are deleted explicitly.
 * Form fields: member_id, confirm_text (must be DELETE).
 */
export async function deleteMemberPermanently(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me || !can(me.role, "deleteMembers")) return { error: "Only a church admin can permanently delete a member." };

  const memberId = uuid.safeParse(formData.get("member_id"));
  if (!memberId.success) return { error: "That member couldn't be found." };
  if (memberId.data === me.id) return { error: "You can't delete your own account from here." };
  if (String(formData.get("confirm_text") ?? "").trim() !== "DELETE") {
    return { error: "Type DELETE in the box to confirm.", fieldErrors: { confirm_text: "Type DELETE (in capitals) to confirm." } };
  }

  const target = await loadMember(memberId.data, me.church_id!);
  if (!target) return { error: "That member couldn't be found in your church." };

  const admin = createAdminClient();
  const { error: careError } = await admin.from("pastoral_care_logs").delete().eq("church_id", me.church_id).eq("member_id", target.id);
  if (careError) return { error: "Couldn't remove this person's care records, so nothing was deleted. Try again." };

  // Files in Storage aren't covered by database cascades: remove the person's
  // profile photos (the whole folder, in case an old one was left behind).
  const photoFolder = `${me.church_id}/${target.id}`;
  const { data: photos } = await admin.storage.from(AVATAR_BUCKET).list(photoFolder);
  if (photos?.length) {
    const { error: photoError } = await admin.storage.from(AVATAR_BUCKET).remove(photos.map((f) => `${photoFolder}/${f.name}`));
    if (photoError) return { error: "Couldn't remove this person's profile photo, so nothing was deleted. Try again." };
  }

  // Their chat messages are removed by the database cascade, but voice notes
  // (and photos) are files in Storage — remove those too.
  const { data: chatFiles } = await admin.from("chat_messages").select("media_path").eq("sender_id", target.id).not("media_path", "is", null);
  const chatPaths = (chatFiles ?? []).map((m) => m.media_path as string).filter((p) => p.startsWith(`${me.church_id}/`));
  if (chatPaths.length) {
    const { error: chatFileError } = await admin.storage.from(CHAT_MEDIA_BUCKET).remove(chatPaths);
    if (chatFileError) return { error: "Couldn't remove this person's voice notes, so nothing was deleted. Try again." };
  }

  const { error } = await admin.auth.admin.deleteUser(target.id);
  if (error) {
    console.error("[members] delete failed:", error.message);
    return { error: "Couldn't delete this account. You can deactivate them instead, and contact support if this keeps happening." };
  }

  // No name in the audit metadata — the point of erasure is not keeping it.
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.deleted", targetTable: "app_users", targetId: target.id });
  revalidatePath("/dashboard/members");
  flash("The member and their personal data were permanently deleted.");
  redirect("/dashboard/members");
}

/**
 * Removes a member's profile photo (e.g. an inappropriate picture). Pastors
 * and church admins; a pastor can't act on a church admin. The record is
 * cleared with the caller's own session (the database only lets others
 * *clear* a photo), the file is removed with the service role, and the
 * action is logged. Form fields: member_id.
 */
export async function removeMemberPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: "Only pastors and church admins can remove a member's photo." };

  const memberId = uuid.safeParse(formData.get("member_id"));
  if (!memberId.success) return { error: "That member couldn't be found." };
  const target = await loadMember(memberId.data, me.church_id!);
  if (!target) return { error: "That member couldn't be found in your church." };
  if (!canEditMemberRole(me, target)) return { error: "You can't change this person's profile." };

  const supabase = createClient();
  const { data: before } = await supabase.from("app_users").select("avatar_path").eq("id", target.id).maybeSingle();
  if (!before?.avatar_path) return { ok: true };

  const { error } = await supabase.from("app_users").update({ avatar_path: null }).eq("id", target.id);
  if (error) {
    console.error("[members] photo removal failed:", error.message);
    return { error: "Couldn't remove the photo — please try again." };
  }
  const { error: fileError } = await createAdminClient().storage.from(AVATAR_BUCKET).remove([before.avatar_path]);
  if (fileError) console.error("[members] photo file not removed:", fileError.message);

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.photo_removed", targetTable: "app_users", targetId: target.id });
  revalidatePath(`/dashboard/members/${target.id}`);
  flash("Profile photo removed.");
  return { ok: true };
}

/**
 * Restricts a member in chat — e.g. after repeated off-topic posts or misuse
 * of voice notes. Pastors and church admins; a pastor can't restrict a church
 * admin. The database enforces the same rule (can_restrict_member) and the
 * restriction itself. Logged. The member can see it, with the reason.
 * Form fields: member_id, kind (group_mute | no_voice), duration (1d | 7d | 30d | lifted), reason.
 */
export async function restrictMemberChat(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: "Only pastors and church admins can restrict members." };

  const parsed = z
    .object({
      memberId: uuid,
      kind: z.enum(Object.keys(RESTRICTION_KINDS) as [RestrictionKind, ...RestrictionKind[]]),
      duration: z.enum(RESTRICTION_DURATIONS.map((d) => d.value) as [RestrictionDuration, ...RestrictionDuration[]]),
      reason: z.string().trim().min(3, "Give a short reason — the member will see it.").max(500),
    })
    .safeParse({ memberId: formData.get("member_id"), kind: formData.get("kind"), duration: formData.get("duration"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return invalid(parsed.error, formData);

  const target = await loadMember(parsed.data.memberId, me.church_id!);
  if (!target) return { error: "That member couldn't be found in your church." };
  if (!canEditMemberRole(me, target)) return { error: "You can't restrict this person." };

  const { data: created, error } = await createClient()
    .from("member_chat_restrictions")
    .insert({
      church_id: me.church_id,
      user_id: target.id,
      kind: parsed.data.kind,
      until: restrictionUntil(parsed.data.duration),
      reason: parsed.data.reason,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[members] chat restriction failed:", error?.message);
    return { error: "Couldn't save the restriction — please try again." };
  }

  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: "member.chat_restricted",
    targetTable: "member_chat_restrictions",
    targetId: created.id,
    metadata: { member_id: target.id, kind: parsed.data.kind, duration: parsed.data.duration },
  });
  revalidatePath(`/dashboard/members/${target.id}`);
  flash(`${target.name}: ${RESTRICTION_KINDS[parsed.data.kind].toLowerCase()}.`);
  return { ok: true };
}

/** Lifts a chat restriction early. Form fields: restriction_id, member_id. Logged. */
export async function liftChatRestriction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: "Only pastors and church admins can lift restrictions." };

  const ids = z.object({ restrictionId: uuid, memberId: uuid }).safeParse({ restrictionId: formData.get("restriction_id"), memberId: formData.get("member_id") });
  if (!ids.success) return { error: "That restriction couldn't be found." };
  const target = await loadMember(ids.data.memberId, me.church_id!);
  if (!target || !canEditMemberRole(me, target)) return { error: "You can't change this person's restrictions." };

  const { error, count } = await createClient()
    .from("member_chat_restrictions")
    .update({ lifted_at: new Date().toISOString(), lifted_by: me.id }, { count: "exact" })
    .eq("id", ids.data.restrictionId)
    .eq("user_id", target.id)
    .is("lifted_at", null);
  if (error || !count) {
    console.error("[members] lift restriction failed:", error?.message);
    return { error: "Couldn't lift the restriction — it may already have ended." };
  }

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.chat_restriction_lifted", targetTable: "member_chat_restrictions", targetId: ids.data.restrictionId, metadata: { member_id: target.id } });
  revalidatePath(`/dashboard/members/${target.id}`);
  flash("Restriction lifted.");
  return { ok: true };
}

// ---------------------------------------------------------------- record-only

const birthDateField = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
  .transform((v) => v || null);

/** A birthday typed on the add-member form (best effort: the member is already added). */
async function saveNewBirthday(memberId: string, me: AppUser, formData: FormData) {
  const birth = birthDateField.safeParse(formData.get("birth_date") ?? "");
  if (!birth.success || !birth.data) return;
  const row = { user_id: memberId, church_id: me.church_id, birth_date: birth.data, updated_by: me.id };
  let { error } = await createAdminClient().from("member_birthdays").upsert({ ...row, announce: formData.get("birthday_announce") === "on" });
  if (error && /announce/.test(error.message)) ({ error } = await createAdminClient().from("member_birthdays").upsert(row));
  if (error) console.error("[members] birthday on create failed:", error.message);
}

/** A sign-in nobody can use: random address and password, and blocked (record_members.sql). */
const recordEmail = () => `record.${crypto.randomUUID()}@no-login.grace.app`;

/**
 * Record only (record_members.sql): someone kept on the church's records who
 * won't use the app — no email or password; doesn't count towards the plan's
 * member limit. Form fields: name, phone?, department_id?, birth_date?
 */
async function createRecordMember(me: AppUser, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Enter their name.").max(120),
      phone: z.string().trim().max(20).optional(),
      departmentId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
    })
    .safeParse({ name: formData.get("name") ?? "", phone: optionalField(formData, "phone"), departmentId: formData.get("department_id") ?? "" });
  const values = formValues(formData);
  if (!parsed.success) return invalid(parsed.error, formData);
  if (!(await departmentBelongsToChurch(parsed.data.departmentId, me.church_id!))) return { error: "That department couldn't be found — refresh and try again.", values };

  const admin = createAdminClient();
  const email = recordEmail();
  const { data: login, error: loginError } = await admin.auth.admin.createUser({
    email,
    password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    email_confirm: true,
    ban_duration: "876000h", // ~100 years: this sign-in can never be used
    user_metadata: { name: parsed.data.name, record_only: true },
  });
  if (loginError || !login.user) {
    console.error("[members] record login failed:", loginError?.message);
    return { error: "We couldn't add them — please try again.", values };
  }
  const { error } = await admin.from("app_users").insert({
    id: login.user.id,
    church_id: me.church_id,
    name: parsed.data.name,
    email,
    phone: parsed.data.phone ?? null,
    role: "member",
    department_id: parsed.data.departmentId,
    status: "active",
    record_only: true,
  });
  if (error) {
    await admin.auth.admin.deleteUser(login.user.id);
    console.error("[members] record insert failed:", error.message);
    return { error: /record_only/.test(error.message) ? "Record-only members need database update #63 (record_members.sql)." : "We couldn't add them — please try again.", values };
  }
  await saveNewBirthday(login.user.id, me, formData);
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.created", targetTable: "app_users", targetId: login.user.id, metadata: { record_only: true } });
  revalidatePath("/dashboard/members");
  flash(`${parsed.data.name} was added to your records.`);
  redirect(`/dashboard/members/${login.user.id}`);
}

/**
 * A record-only member starts using the app: give them an email and a first
 * password (they choose their own when they first sign in). Form fields:
 * member_id, email, password
 */
export async function giveAppAccess(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: SESSION_EXPIRED };
  const parsed = z
    .object({
      memberId: z.string().uuid(),
      email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
      password: passwordSchema,
    })
    .safeParse({ memberId: formData.get("member_id"), email: formData.get("email") ?? "", password: formData.get("password") ?? "" });
  if (!parsed.success) {
    const r = invalid(parsed.error, formData);
    if (r?.values) delete r.values.password;
    return r;
  }
  const values = formValues(formData);
  delete values.password;
  const admin = createAdminClient();
  const { data: target } = await admin.from("app_users").select("id, church_id, name, record_only").eq("id", parsed.data.memberId).maybeSingle();
  if (!target || target.church_id !== me.church_id || !target.record_only) return { error: "That member couldn't be found.", values };
  const { data: taken } = await admin.from("app_users").select("id").eq("email", parsed.data.email).neq("id", target.id).maybeSingle();
  if (taken) return { error: "Please fix the highlighted fields.", fieldErrors: { email: "That email already has a Grace account." }, values };

  const { error: authError } = await admin.auth.admin.updateUserById(target.id, {
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: { name: target.name, must_change_password: true, record_only: false },
  });
  if (authError) {
    console.error("[members] give access failed:", authError.message);
    return { error: /already|registered|exists/i.test(authError.message) ? "That email already has a Grace account." : "Couldn't set up their sign-in — please try again.", values };
  }
  const { error } = await admin.from("app_users").update({ email: parsed.data.email, record_only: false }).eq("id", target.id);
  if (error) return { error: "Their sign-in is ready but the profile didn't update — please try again.", values };
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.app_access_given", targetTable: "app_users", targetId: target.id });
  revalidatePath(`/dashboard/members/${target.id}`);
  revalidatePath("/dashboard/members");
  flash(`${target.name} can sign in now with ${parsed.data.email} and the password you chose.`);
  return { ok: true };
}
