import "server-only";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { MODULE_LABELS, type ModuleKey } from "@/lib/subscription";
import { FeatureUnavailable } from "@/components/ui/Gates";

/**
 * Page-level feature gate. Every gated page starts with:
 *
 *   const gate = await moduleGate("members");
 *   if (gate) return gate;
 *
 * so "not on your plan" looks the same everywhere. Server actions call
 * checkModuleAccess() directly (they return an error, not a screen).
 */
export async function moduleGate(moduleKey: ModuleKey) {
  const access = await checkModuleAccess(moduleKey);
  if (access.allowed) return null;
  const me = await getCurrentAppUser();
  return (
    <FeatureUnavailable
      featureName={MODULE_LABELS[moduleKey]}
      reason={access.reason}
      kind={access.kind}
      canManageBilling={can(me?.role, "manageBilling")}
    />
  );
}
