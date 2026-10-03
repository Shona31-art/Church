"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";

type AddChurchResult = { error?: string } | null;

async function cleanUp(admin: ReturnType<typeof createAdminClient>, churchId: string, authUserId?: string) {
  const errors: string[] = [];

  if (authUserId) {
    const { error } = await admin.auth.admin.deleteUser(authUserId);
    if (error) errors.push(`Could not remove the invited admin account: ${error.message}`);
  }

  const { error } = await admin.from("churches").delete().eq("id", churchId);
  if (error) errors.push(`Could not remove the partially created church: ${error.message}`);

  return errors;
}

export async function addChurch(_prevState: AddChurchResult, formData: FormData): Promise<AddChurchResult> {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return { error: "Only a platform super admin can add a church." };
  }

  const churchName = String(formData.get("church_name") ?? "").trim();
  const adminName = String(formData.get("admin_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!churchName || !adminName || !email) {
    return { error: "Church name, admin name, and admin email are required." };
  }
  if (password.length < 6) {
    return { error: "The admin password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "The passwords do not match." };
  }
  if (churchName.length > 200 || adminName.length > 200 || email.length > 320 || phone.length > 50) {
    return { error: "One or more fields are too long." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid admin email address." };
  }

  const admin = createAdminClient();
  const { data: church, error: churchError } = await admin
    .from("churches")
    .insert({ name: churchName, email, phone: phone || null })
    .select("id")
    .single();

  if (churchError || !church) {
    return { error: churchError?.message || "Could not create the church." };
  }

  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + 30);

  const { error: subscriptionError } = await admin.from("church_subscriptions").insert({
    church_id: church.id,
    plan_key: "free_trial",
    status: "trial",
    trial_expires_at: trialExpiresAt.toISOString(),
  });

  if (subscriptionError) {
    const cleanupErrors = await cleanUp(admin, church.id);
    return {
      error: `Could not create the church trial: ${subscriptionError.message}${cleanupErrors.length ? ` ${cleanupErrors.join(" ")}` : ""}`,
    };
  }

  const { data: createdAuthUser, error: authUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: adminName },
  });

  if (authUserError || !createdAuthUser.user) {
    const cleanupErrors = await cleanUp(admin, church.id);
    return {
      error: `Could not create the first church admin account: ${authUserError?.message || "No Auth user was returned."}${cleanupErrors.length ? ` ${cleanupErrors.join(" ")}` : ""}`,
    };
  }

  const { error: profileError } = await admin.from("app_users").insert({
    id: createdAuthUser.user.id,
    church_id: church.id,
    name: adminName,
    email,
    phone: phone || null,
    role: "church_admin",
    status: "active",
  });

  if (profileError) {
    const cleanupErrors = await cleanUp(admin, church.id, createdAuthUser.user.id);
    return {
      error: `The admin login was created, but their profile could not be created: ${profileError.message}${cleanupErrors.length ? ` ${cleanupErrors.join(" ")}` : ""}`,
    };
  }

  const { error: channelError } = await admin.from("chat_channels").insert({
    church_id: church.id,
    department_id: null,
    name: "General",
  });

  if (channelError) {
    const cleanupErrors = await cleanUp(admin, church.id, createdAuthUser.user.id);
    return {
      error: `Church setup could not finish creating its General chat channel: ${channelError.message}${cleanupErrors.length ? ` ${cleanupErrors.join(" ")}` : ""}`,
    };
  }

  redirect("/dashboard/super-admin/churches");
}
