"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";

type UserActionState = { error?: string; success?: string } | null;
const CHURCH_ROLES = ["church_admin", "pastor", "department_leader", "member"] as const;

function isChurchRole(role: string): role is (typeof CHURCH_ROLES)[number] {
  return CHURCH_ROLES.some((allowedRole) => allowedRole === role);
}

async function removeAuthUser(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  return error?.message;
}

export async function createPlatformUser(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return { error: "Only a platform super admin can create users." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const churchId = String(formData.get("church_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const departmentId = String(formData.get("department_id") ?? "") || null;
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!name || !email || !churchId || !role || !password) {
    return { error: "Name, email, church, role, and password are required." };
  }
  if (name.length > 200 || email.length > 320 || phone.length > 50) {
    return { error: "One or more fields are too long." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!isChurchRole(role)) {
    return { error: "Select a valid church role." };
  }
  if (password.length < 6) {
    return { error: "The password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "The passwords do not match." };
  }
  if (role === "department_leader" && !departmentId) {
    return { error: "Choose a department for a department leader." };
  }

  const admin = createAdminClient();
  const { data: church, error: churchError } = await admin
    .from("churches")
    .select("id")
    .eq("id", churchId)
    .maybeSingle();

  if (churchError || !church) {
    return { error: churchError?.message || "Select an existing church." };
  }

  if (departmentId) {
    const { data: department, error: departmentError } = await admin
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("church_id", churchId)
      .maybeSingle();

    if (departmentError || !department) {
      return { error: departmentError?.message || "The selected department does not belong to that church." };
    }
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError || !created.user) {
    return { error: authError?.message || "Supabase did not return the created user." };
  }

  const { error: profileError } = await admin.from("app_users").insert({
    id: created.user.id,
    church_id: churchId,
    department_id: departmentId,
    name,
    email,
    phone: phone || null,
    role,
    status: "active",
  });

  if (profileError) {
    const cleanupError = await removeAuthUser(created.user.id);
    return {
      error: `The login was created, but its church profile could not be saved: ${profileError.message}${cleanupError ? ` Cleanup also failed: ${cleanupError}` : ""}`,
    };
  }

  revalidatePath("/dashboard/super-admin/users");
  return { success: "User created. They can sign in with the email and password you set." };
}

export async function setPlatformUserPassword(
  _prevState: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return { error: "Only a platform super admin can set user passwords." };
  }

  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { error: "Invalid user selected." };
  }
  if (password.length < 6) {
    return { error: "The password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "The passwords do not match." };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("app_users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: profileError?.message || "The selected user profile was not found." };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (authError) {
    return { error: authError.message };
  }

  const { data: activatedProfile, error: activationError } = await admin
    .from("app_users")
    .update({ status: "active" })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (activationError || !activatedProfile) {
    return {
      error: `The password was updated, but the profile could not be activated: ${activationError?.message || "profile not found"}`,
    };
  }

  revalidatePath("/dashboard/super-admin/users");
  return { success: "Password updated and account activated. The user can sign in with the new password." };
}
