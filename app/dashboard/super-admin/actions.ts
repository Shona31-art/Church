"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { provisionChurch } from "@/lib/provision";
import { CHURCH_ROLES } from "@/lib/permissions";
import { MODULE_KEYS } from "@/lib/subscription";
import { churchNameSchema, emailSchema, passwordSchema } from "@/lib/account-schemas";
import { nameSchema, phoneSchema } from "@/lib/member-schemas";
import { FormState, SESSION_EXPIRED, formValues, invalid, optionalField } from "@/lib/forms";

// Platform administration. Every action re-checks super_admin from the
// session. Where the service-role client is needed (creating logins,
// passwords, deleting accounts), the same rules RLS would enforce are
// checked here first. Everything is audit-logged.

const PLAN_KEYS = ["free_trial", "basic", "premium", "enterprise", "sponsored"] as const;
const ACCOUNT_STATUSES = ["active", "trial", "payment_pending", "grace", "suspended"] as const;
const uuid = z.string().uuid();
const isoDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).transform((v) => (v ? `${v}T23:59:59Z` : null));

async function requireSuperAdmin(): Promise<AppUser | null> {
  const me = await getCurrentAppUser();
  return me?.role === "super_admin" ? me : null;
}
const DENIED = { error: "Only platform super admins can do this. If you are one, sign in again." };

// ---------------------------------------------------------------- churches

/** Form fields: church_name, admin_name, email, phone?, password, confirm_password */
export async function addChurch(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;

  const parsed = z
    .object({
      church_name: churchNameSchema,
      admin_name: nameSchema,
      email: emailSchema,
      phone: phoneSchema,
      password: passwordSchema,
      confirm_password: z.string(),
    })
    .refine((v) => v.password === v.confirm_password, { message: "The passwords don't match.", path: ["confirm_password"] })
    .safeParse({
      church_name: formData.get("church_name"),
      admin_name: formData.get("admin_name"),
      email: formData.get("email"),
      phone: optionalField(formData, "phone"),
      password: formData.get("password") ?? "",
      confirm_password: formData.get("confirm_password") ?? "",
    });
  const values = formValues(formData);
  delete values.password;
  delete values.confirm_password;
  if (!parsed.success) return { ...invalid(parsed.error), values };
  const input = parsed.data;

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.admin_name },
  });
  if (authError || !created.user) {
    return { error: /already/i.test(authError?.message ?? "") ? "That email already has an account." : "Couldn't create the admin login — please try again.", values };
  }

  const result = await provisionChurch({ userId: created.user.id, churchName: input.church_name, adminName: input.admin_name, email: input.email, phone: input.phone });
  if (!result.ok) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: result.error, values };
  }

  await logAudit({ churchId: result.churchId, actorId: me.id, action: "church.created", targetTable: "churches", targetId: result.churchId });
  revalidatePath("/dashboard/super-admin/churches");
  flash(`${input.church_name} was created with a 30-day trial. Share the admin's password with them securely.`);
  redirect(`/dashboard/super-admin/churches/${result.churchId}`);
}

/** Form fields: church_id, plan_key, status, is_lifetime?, trial_expires_at?, grace_period_end?, price_override?, notes? */
export async function updateSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;

  const parsed = z
    .object({
      churchId: uuid,
      plan_key: z.enum(PLAN_KEYS),
      status: z.enum(ACCOUNT_STATUSES),
      is_lifetime: z.boolean(),
      trial_expires_at: isoDate,
      grace_period_end: isoDate,
      price_override: z
        .union([z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a price like 199 or 199.50"), z.literal("")])
        .transform((v) => (v ? Number(v) : null)),
      notes: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      churchId: formData.get("church_id"),
      plan_key: formData.get("plan_key"),
      status: formData.get("status"),
      is_lifetime: formData.get("is_lifetime") === "on",
      trial_expires_at: formData.get("trial_expires_at") ?? "",
      grace_period_end: formData.get("grace_period_end") ?? "",
      price_override: formData.get("price_override") ?? "",
      notes: optionalField(formData, "notes"),
    });
  if (!parsed.success) return invalid(parsed.error, formData);
  const { churchId, ...payload } = parsed.data;

  const supabase = createClient();
  const { data: before } = await supabase.from("church_subscriptions").select("plan_key, status, is_lifetime").eq("church_id", churchId).maybeSingle();
  const row = {
    ...payload,
    notes: payload.notes ?? null,
    suspended_at: payload.status === "suspended" ? new Date().toISOString() : null,
  };
  const { error } = before
    ? await supabase.from("church_subscriptions").update(row).eq("church_id", churchId)
    : await supabase.from("church_subscriptions").insert({ church_id: churchId, ...row });
  if (error) {
    console.error("[super-admin] subscription save failed:", error.message);
    return { error: "Couldn't save the subscription — please try again." };
  }

  await logAudit({ churchId, actorId: me.id, action: "subscription.updated", targetTable: "church_subscriptions", targetId: churchId, metadata: { from: before, to: { plan_key: payload.plan_key, status: payload.status, is_lifetime: payload.is_lifetime } } });
  revalidatePath(`/dashboard/super-admin/churches/${churchId}`);
  revalidatePath("/dashboard/super-admin/churches");
  flash("Subscription saved. The church sees the change immediately.");
  return { ok: true };
}

/** Form fields: church_id, module_key, mode ("on" | "off" | "plan") */
export async function setModuleOverride(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;
  const parsed = z
    .object({ churchId: uuid, moduleKey: z.enum(MODULE_KEYS), mode: z.enum(["on", "off", "plan"]) })
    .safeParse({ churchId: formData.get("church_id"), moduleKey: formData.get("module_key"), mode: formData.get("mode") });
  if (!parsed.success) return { error: "That module setting isn't valid." };
  const { churchId, moduleKey, mode } = parsed.data;

  const supabase = createClient();
  const { error } =
    mode === "plan"
      ? await supabase.from("church_modules").delete().eq("church_id", churchId).eq("module_key", moduleKey)
      : await supabase.from("church_modules").upsert({ church_id: churchId, module_key: moduleKey, enabled: mode === "on", set_by: me.id, set_at: new Date().toISOString() });
  if (error) {
    console.error("[super-admin] module override failed:", error.message);
    return { error: "Couldn't change that module — please try again." };
  }
  await logAudit({ churchId, actorId: me.id, action: `module.${mode === "plan" ? "override_cleared" : mode === "on" ? "forced_on" : "forced_off"}`, targetTable: "church_modules", metadata: { module_key: moduleKey } });
  revalidatePath(`/dashboard/super-admin/churches/${churchId}`);
  return { ok: true };
}

// ------------------------------------------------------------------- users

/** Form fields: name, email, phone?, church_id, role, department_id?, password, confirm_password */
export async function createPlatformUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;

  const parsed = z
    .object({
      name: nameSchema,
      email: emailSchema,
      phone: phoneSchema,
      church_id: uuid,
      role: z.enum(CHURCH_ROLES, { message: "Choose a role." }),
      department_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
      password: passwordSchema,
      confirm_password: z.string(),
    })
    .refine((v) => v.password === v.confirm_password, { message: "The passwords don't match.", path: ["confirm_password"] })
    .refine((v) => v.role !== "department_leader" || v.department_id, { message: "Choose the department they lead.", path: ["department_id"] })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: optionalField(formData, "phone"),
      church_id: formData.get("church_id"),
      role: formData.get("role"),
      department_id: formData.get("department_id") ?? "",
      password: formData.get("password") ?? "",
      confirm_password: formData.get("confirm_password") ?? "",
    });
  const values = formValues(formData);
  delete values.password;
  delete values.confirm_password;
  if (!parsed.success) return { ...invalid(parsed.error), values };
  const input = parsed.data;

  const admin = createAdminClient();
  if (input.department_id) {
    const { data: dept } = await admin.from("departments").select("id").eq("id", input.department_id).eq("church_id", input.church_id).maybeSingle();
    if (!dept) return { error: "That department doesn't belong to the chosen church.", fieldErrors: { department_id: "Pick a department from the chosen church." }, values };
  }
  const { data: church } = await admin.from("churches").select("id").eq("id", input.church_id).maybeSingle();
  if (!church) return { error: "Choose an existing church.", values };

  const { data: created, error: authError } = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { name: input.name } });
  if (authError || !created.user) {
    return { error: /already/i.test(authError?.message ?? "") ? "That email already has an account." : "Couldn't create the login — please try again.", values };
  }
  const { error: profileError } = await admin.from("app_users").insert({
    id: created.user.id,
    church_id: input.church_id,
    department_id: input.department_id,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    role: input.role,
    status: "active",
  });
  if (profileError) {
    console.error("[super-admin] profile insert failed:", profileError.message);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Couldn't create the user's profile, so the login was removed. Please try again.", values };
  }

  await logAudit({ churchId: input.church_id, actorId: me.id, action: "user.created_by_platform", targetTable: "app_users", targetId: created.user.id, metadata: { role: input.role } });
  revalidatePath("/dashboard/super-admin/users");
  flash(`${input.name} was created. Share their password with them securely.`);
  redirect(`/dashboard/super-admin/users/${created.user.id}`);
}

/** Form fields: user_id, name, phone?, church_id, role, department_id? */
export async function updatePlatformUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;

  const parsed = z
    .object({
      userId: uuid,
      name: nameSchema,
      phone: phoneSchema,
      churchId: uuid,
      role: z.enum(CHURCH_ROLES),
      departmentId: z.union([uuid, z.literal("")]).transform((v) => v || null),
    })
    .safeParse({
      userId: formData.get("user_id"),
      name: formData.get("name"),
      phone: optionalField(formData, "phone"),
      churchId: formData.get("church_id"),
      role: formData.get("role"),
      departmentId: formData.get("department_id") ?? "",
    });
  if (!parsed.success) return invalid(parsed.error, formData);
  const input = parsed.data;

  const supabase = createClient();
  const { data: target } = await supabase.from("app_users").select("id, role, church_id, department_id").eq("id", input.userId).maybeSingle();
  if (!target) return { error: "That user couldn't be found." };
  if (target.role === "super_admin") return { error: "Platform admin accounts can't be changed from here." };

  // Moving church: the old church's department no longer applies.
  const departmentId = input.churchId !== target.church_id ? null : input.departmentId;
  if (departmentId) {
    const { data: dept } = await supabase.from("departments").select("id").eq("id", departmentId).eq("church_id", input.churchId).maybeSingle();
    if (!dept) return { error: "That department isn't in the chosen church." };
  }
  if (input.role === "department_leader" && !departmentId) {
    return { error: "A department leader needs a department in their church.", fieldErrors: { department_id: "Choose a department." } };
  }

  const { error } = await supabase
    .from("app_users")
    .update({ name: input.name, phone: input.phone ?? null, church_id: input.churchId, role: input.role, department_id: departmentId })
    .eq("id", input.userId);
  if (error) {
    console.error("[super-admin] user update failed:", error.message);
    return { error: "Couldn't save the user — please try again." };
  }

  await logAudit({
    churchId: input.churchId,
    actorId: me.id,
    action: input.churchId !== target.church_id ? "user.moved_church" : "user.updated_by_platform",
    targetTable: "app_users",
    targetId: input.userId,
    metadata: { from: { church_id: target.church_id, role: target.role }, to: { church_id: input.churchId, role: input.role } },
  });
  revalidatePath(`/dashboard/super-admin/users/${input.userId}`);
  revalidatePath("/dashboard/super-admin/users");
  flash("User saved.");
  return { ok: true };
}

/** Form fields: user_id, to ("active" | "disabled") */
export async function setPlatformUserStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;
  const userId = uuid.safeParse(formData.get("user_id"));
  const to = z.enum(["active", "disabled"]).safeParse(formData.get("to"));
  if (!userId.success || !to.success) return { error: "That action isn't valid." };
  if (userId.data === me.id) return { error: "You can't disable your own account." };

  const supabase = createClient();
  const { data: target } = await supabase.from("app_users").select("role, church_id").eq("id", userId.data).maybeSingle();
  if (!target) return { error: "That user couldn't be found." };
  if (target.role === "super_admin") return { error: "Platform admin accounts can't be disabled from here." };

  const { error } = await supabase.from("app_users").update({ status: to.data }).eq("id", userId.data);
  if (error) return { error: "Couldn't change their access — please try again." };
  await logAudit({ churchId: target.church_id, actorId: me.id, action: to.data === "disabled" ? "user.disabled_by_platform" : "user.enabled_by_platform", targetTable: "app_users", targetId: userId.data });
  revalidatePath(`/dashboard/super-admin/users/${userId.data}`);
  revalidatePath("/dashboard/super-admin/users");
  flash(to.data === "disabled" ? "Account disabled. They can't sign in." : "Account enabled.");
  return { ok: true };
}

/** Form fields: user_id, password, confirm_password */
export async function setPlatformUserPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;
  const parsed = z
    .object({ userId: uuid, password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] })
    .safeParse({ userId: formData.get("user_id"), password: formData.get("password") ?? "", confirm: formData.get("confirm_password") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the password." };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("app_users").select("id, church_id, role, status").eq("id", parsed.data.userId).maybeSingle();
  if (!profile) return { error: "That user couldn't be found." };
  if (profile.role === "super_admin" && profile.id !== me.id) return { error: "Other platform admins must reset their own password." };

  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password, email_confirm: true });
  if (error) {
    console.error("[super-admin] password set failed:", error.message);
    return { error: "Couldn't set the password — please try again." };
  }
  if (profile.status === "invited") await admin.from("app_users").update({ status: "active" }).eq("id", profile.id);

  await logAudit({ churchId: profile.church_id, actorId: me.id, action: "user.password_set_by_platform", targetTable: "app_users", targetId: profile.id });
  flash("Password set. Share it with them securely — it isn't stored anywhere you can see again.");
  return { ok: true };
}

/** Form fields: user_id, confirm_text ("DELETE") */
export async function deletePlatformUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSuperAdmin();
  if (!me) return DENIED;
  const userId = uuid.safeParse(formData.get("user_id"));
  if (!userId.success) return { error: "That user couldn't be found." };
  if (String(formData.get("confirm_text") ?? "").trim() !== "DELETE") return { error: "Type DELETE to confirm.", fieldErrors: { confirm_text: "Type DELETE (in capitals) to confirm." } };
  if (userId.data === me.id) return { error: "You can't delete your own account." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("app_users").select("role, church_id").eq("id", userId.data).maybeSingle();
  if (!target) return { error: "That user couldn't be found." };
  if (target.role === "super_admin") return { error: "Platform admin accounts can't be deleted from here." };

  await admin.from("pastoral_care_logs").delete().eq("member_id", userId.data);
  const { error } = await admin.auth.admin.deleteUser(userId.data);
  if (error) {
    console.error("[super-admin] delete failed:", error.message);
    return { error: "Couldn't delete the account — please try again." };
  }
  await logAudit({ churchId: target.church_id, actorId: me.id, action: "user.deleted_by_platform", targetTable: "app_users", targetId: userId.data });
  revalidatePath("/dashboard/super-admin/users");
  flash("Account and personal data deleted.");
  redirect("/dashboard/super-admin/users");
}
