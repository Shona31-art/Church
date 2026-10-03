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
import { FormState, SESSION_EXPIRED, formValues, invalid, optionalField } from "@/lib/forms";

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
 * Plan member limits (plans.member_limit; null = unlimited). Deactivated
 * people don't count, so a church can make room by deactivating.
 */
async function memberLimitReached(churchId: string): Promise<{ reached: boolean; limit: number | null }> {
  const supabase = createClient();
  const { data: sub } = await supabase.from("church_subscriptions").select("plan_key").eq("church_id", churchId).maybeSingle();
  if (!sub) return { reached: false, limit: null };
  const { data: plan } = await supabase.from("plans").select("member_limit").eq("key", sub.plan_key).maybeSingle();
  const limit = plan?.member_limit ?? null;
  if (limit === null) return { reached: false, limit };
  const { count } = await supabase
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .neq("status", "disabled");
  return { reached: (count ?? 0) >= limit, limit };
}

/**
 * Add member: creates their login (invite email) and church profile.
 * Form fields: name, email, phone?, role, department_id?
 */
export async function createMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireMemberManager();
  if (!me) return { error: "Only pastors and church admins can add members. If you are one, sign in again." };

  const parsed = memberCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: optionalField(formData, "phone"),
    role: formData.get("role"),
    departmentId: formData.get("department_id") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const input = parsed.data;
  const values = formValues(formData);

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
  const limit = await memberLimitReached(me.church_id!);
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

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: new URL("/reset-password", APP_URL).toString(),
    data: { name: input.name },
  });
  if (inviteError || !invited.user) {
    console.error("[members] invite failed:", inviteError?.message);
    const already = /already/i.test(inviteError?.message ?? "");
    return {
      error: already
        ? "That email already has a login. Ask platform support to link it to your church."
        : "We couldn't send the invite email. Check the address and try again in a minute.",
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
      status: "invited",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("[members] profile insert failed:", insertError?.message);
    // Don't leave a login with no profile behind.
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: "We couldn't create the member profile, so the invite was cancelled. Please try again.", values };
  }

  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: "member.invited",
    targetTable: "app_users",
    targetId: created.id,
    metadata: { role: input.role },
  });

  revalidatePath("/dashboard/members");
  flash(`${input.name} was added. An invite email is on its way to ${input.email}.`);
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

  const { error: bdayError } = input.birthDate
    ? await supabase
        .from("member_birthdays")
        .upsert({ user_id: input.memberId, church_id: me.church_id, birth_date: input.birthDate, updated_by: me.id })
    : await supabase.from("member_birthdays").delete().eq("user_id", input.memberId);
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
    const limit = await memberLimitReached(me.church_id!);
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
