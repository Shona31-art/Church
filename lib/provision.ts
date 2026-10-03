import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates a church with its 30-day trial, its first church admin profile and
 * its church-wide chat channel. Used by self-service registration and by
 * super admins adding a church.
 *
 * Service role on purpose: there is no church yet for RLS to scope against.
 * Callers MUST pass a userId they created themselves in the same request —
 * never one supplied by the browser. If any step fails, everything created
 * here is removed again so no half-built church is left behind (the caller
 * removes the auth user).
 */
export async function provisionChurch(params: {
  userId: string;
  churchName: string;
  adminName: string;
  email: string;
  phone?: string | null;
}): Promise<{ ok: true; churchId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: church, error: churchError } = await admin
    .from("churches")
    .insert({ name: params.churchName, email: params.email, phone: params.phone || null })
    .select("id")
    .single();
  if (churchError || !church) {
    console.error("[provision] church insert failed:", churchError?.message);
    return { ok: false, error: "We couldn't create your church — please try again." };
  }

  const fail = async (step: string, message?: string) => {
    console.error(`[provision] ${step} failed:`, message);
    // Cascades remove the subscription, profile and channel with the church.
    await admin.from("churches").delete().eq("id", church.id);
    return { ok: false as const, error: "We couldn't finish setting up your church — please try again." };
  };

  const trialExpiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const { error: subError } = await admin
    .from("church_subscriptions")
    .insert({ church_id: church.id, plan_key: "free_trial", status: "trial", trial_expires_at: trialExpiresAt });
  if (subError) return fail("subscription", subError.message);

  const { error: userError } = await admin.from("app_users").insert({
    id: params.userId,
    church_id: church.id,
    name: params.adminName,
    email: params.email,
    phone: params.phone || null,
    role: "church_admin",
    status: "active",
  });
  if (userError) return fail("admin profile", userError.message);

  const { error: channelError } = await admin.from("chat_channels").insert({ church_id: church.id, department_id: null, name: "General" });
  if (channelError) return fail("general channel", channelError.message);

  return { ok: true, churchId: church.id };
}
