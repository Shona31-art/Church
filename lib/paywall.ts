import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import {
  EffectiveStatus,
  ModuleKey,
  MODULE_KEYS,
  enabledModules,
  resolveAccountStatus,
  daysUntil,
} from "@/lib/subscription";

export type { ModuleKey } from "@/lib/subscription";

export interface AccessCheckResult {
  allowed: boolean;
  /** Why not, in words safe to show the user. */
  reason?: string;
  /** "plan" = upgrade would help; "suspended" = renew; "account" = sign-in/profile problem. */
  kind?: "plan" | "suspended" | "account";
}

export interface ChurchAccess {
  status: EffectiveStatus | "none" | "error";
  planKey: string | null;
  modules: Set<ModuleKey>;
  trialDaysLeft: number | null;
  graceDaysLeft: number | null;
}

/**
 * The current church's subscription and enabled modules, read once per
 * request (React `cache`) and shared by the navigation, every page gate and
 * every server action. Reads go through the user's own session, so RLS
 * guarantees a church can only ever see its own subscription.
 */
export const getChurchAccess = cache(async (): Promise<ChurchAccess | null> => {
  const me = await getCurrentAppUser();
  if (!me) return null;

  if (me.role === "super_admin") {
    return { status: "active", planKey: null, modules: new Set(MODULE_KEYS), trialDaysLeft: null, graceDaysLeft: null };
  }
  if (!me.church_id) return null;

  const supabase = createClient();
  const { data: subscription, error: subscriptionError } = await supabase
    .from("church_subscriptions")
    .select("plan_key, status, is_lifetime, trial_expires_at, grace_period_end")
    .eq("church_id", me.church_id)
    .maybeSingle();

  if (subscriptionError) {
    console.error("[paywall] couldn't load church subscription:", subscriptionError.message);
    return { status: "error", planKey: null, modules: new Set(), trialDaysLeft: null, graceDaysLeft: null };
  }

  if (!subscription) {
    return { status: "none", planKey: null, modules: new Set(), trialDaysLeft: null, graceDaysLeft: null };
  }

  const [{ data: planModules, error: planModulesError }, { data: overrides, error: overridesError }] = await Promise.all([
    supabase.from("plan_modules").select("module_key").eq("plan_key", subscription.plan_key),
    supabase.from("church_modules").select("module_key, enabled").eq("church_id", me.church_id),
  ]);

  if (planModulesError || overridesError) {
    if (planModulesError) console.error("[paywall] couldn't load plan modules:", planModulesError.message);
    if (overridesError) console.error("[paywall] couldn't load church module overrides:", overridesError.message);
    return {
      status: "error",
      planKey: subscription.plan_key,
      modules: new Set(),
      trialDaysLeft: null,
      graceDaysLeft: null,
    };
  }

  const status = resolveAccountStatus(subscription);
  return {
    status,
    planKey: subscription.plan_key,
    modules: status === "suspended" ? new Set() : enabledModules((planModules ?? []).map((m) => m.module_key), overrides ?? []),
    trialDaysLeft: status === "trial" ? daysUntil(subscription.trial_expires_at) : null,
    graceDaysLeft: status === "grace" ? daysUntil(subscription.grace_period_end) : null,
  };
});

/**
 * Server-side check: may the current user use this module? Call at the top
 * of every page and server action for a gated module, before any reads or
 * writes. RLS remains the hard boundary; this turns "not on your plan" into a
 * clear message instead of an empty page or a raw database error.
 */
export async function checkModuleAccess(moduleKey: ModuleKey): Promise<AccessCheckResult> {
  const access = await getChurchAccess();
  if (!access) return { allowed: false, kind: "account", reason: "Your session has expired — please sign in again." };
  if (access.status === "error") {
    return {
      allowed: false,
      kind: "account",
      reason: "We couldn't verify your church's feature access. Refresh the page, and contact support if the problem continues.",
    };
  }
  if (access.status === "none") {
    return { allowed: false, kind: "account", reason: "Your church doesn't have a subscription set up yet. Contact support." };
  }
  if (access.status === "suspended") {
    return {
      allowed: false,
      kind: "suspended",
      reason: "Your church's subscription has ended. A church admin can renew it from Billing to restore access.",
    };
  }
  if (!access.modules.has(moduleKey)) {
    return { allowed: false, kind: "plan", reason: "This feature isn't included in your church's current plan." };
  }
  return { allowed: true };
}
