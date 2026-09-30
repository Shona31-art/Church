import { createClient } from "@/lib/supabase/server";

export type ModuleKey =
  | "members"
  | "announcements"
  | "calendar"
  | "service_planner"
  | "pastor_booking"
  | "ai_poster"
  | "sermon_ai"
  | "dept_chats"
  | "bible"
  | "analytics"
  | "multi_campus"
  | "ai_counseling"
  | "prayer_board"
  | "journal"
  | "support"
  | "bible_games"
  | "giving"
  | "pastoral_care"
  | "bible_study_ai";

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Server-side check: is the current logged-in user allowed to use this module?
 * Call this at the top of any server action / route handler that touches a
 * gated module, before doing any reads or writes.
 *
 * Note: this is a *defense-in-depth* check, not the only line of defense —
 * RLS policies in Postgres are the actual hard boundary. This check exists
 * so the app can show a friendly "upgrade to unlock" message instead of a
 * raw database permission error.
 */
export async function checkModuleAccess(moduleKey: ModuleKey): Promise<AccessCheckResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, reason: "Not signed in." };
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role, church_id")
    .eq("id", user.id)
    .single();

  if (!appUser) {
    return { allowed: false, reason: "User profile not found." };
  }

  if (appUser.role === "super_admin") {
    return { allowed: true };
  }

  if (!appUser.church_id) {
    return { allowed: false, reason: "No church associated with this account." };
  }

  const { data: subscription } = await supabase
    .from("church_subscriptions")
    .select("*")
    .eq("church_id", appUser.church_id)
    .single();

  if (!subscription) {
    return { allowed: false, reason: "No subscription found for this church." };
  }

  const status = resolveAccountStatus(subscription);
  if (status === "suspended") {
    return {
      allowed: false,
      reason: "Your church's subscription has expired. Renew to restore access.",
    };
  }

  // Check plan_modules for default availability
  const { data: planModule } = await supabase
    .from("plan_modules")
    .select("module_key")
    .eq("plan_key", subscription.plan_key)
    .eq("module_key", moduleKey)
    .maybeSingle();

  // Check church_modules for a manual override (takes precedence either direction)
  const { data: override } = await supabase
    .from("church_modules")
    .select("enabled")
    .eq("church_id", appUser.church_id)
    .eq("module_key", moduleKey)
    .maybeSingle();

  const enabled = override ? override.enabled : Boolean(planModule);

  if (!enabled) {
    return {
      allowed: false,
      reason: "This feature is not included in your church's current plan.",
    };
  }

  return { allowed: true };
}

function resolveAccountStatus(sub: any): "active" | "trial" | "grace" | "suspended" | "payment_pending" {
  const now = new Date();
  if (sub.is_lifetime) return "active";
  if (sub.status === "suspended") return "suspended";

  if (sub.plan_key === "free_trial") {
    if (sub.trial_expires_at && now > new Date(sub.trial_expires_at)) return "suspended";
    return "trial";
  }

  if (sub.status === "grace") {
    if (sub.grace_period_end && now > new Date(sub.grace_period_end)) return "suspended";
    return "grace";
  }

  if (sub.status === "payment_pending") return "payment_pending";
  return "active";
}
