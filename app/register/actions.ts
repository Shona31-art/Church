"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Runs after a brand-new auth user has signed up. Creates their church,
 * a 30-day free trial subscription, and their app_users row as church_admin.
 *
 * Uses the ADMIN (service role) client deliberately: at this point there is
 * no church yet for RLS to scope against, so this is inherently a
 * bypass-RLS bootstrap operation — same category as the member-invite flow.
 * Every other write in the app goes through the regular session-scoped
 * client so RLS applies; this function is the one deliberate exception,
 * and it's not reachable by anyone except right after their own signUp.
 */
export async function provisionChurch(params: {
  userId: string;
  churchName: string;
  adminName: string;
  email: string;
  phone?: string;
}): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: church, error: churchError } = await admin
    .from("churches")
    .insert({ name: params.churchName, phone: params.phone || null, email: params.email })
    .select("id")
    .single();

  if (churchError || !church) {
    return { success: false, error: churchError?.message || "Could not create church." };
  }

  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + 30);

  const { error: subError } = await admin.from("church_subscriptions").insert({
    church_id: church.id,
    plan_key: "free_trial",
    status: "trial",
    trial_expires_at: trialExpiresAt.toISOString(),
  });

  if (subError) {
    return { success: false, error: subError.message };
  }

  const { error: userError } = await admin.from("app_users").insert({
    id: params.userId,
    church_id: church.id,
    name: params.adminName,
    email: params.email,
    phone: params.phone || null,
    role: "church_admin",
    status: "active",
  });

  if (userError) {
    return { success: false, error: userError.message };
  }

  // Every church gets a "General" church-wide chat channel automatically —
  // department_id null means it's visible to everyone, not just one department.
  await admin.from("chat_channels").insert({
    church_id: church.id,
    department_id: null,
    name: "General",
  });

  return { success: true };
}
