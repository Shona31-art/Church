import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { Alert } from "@/components/ui/Alert";
import { planCodesFromEnv } from "@/lib/billing";
import { EDITABLE_PLANS } from "./plans";
import { PlanForm, type PlanRow } from "./PlanForm";

export default async function PlansPage() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="Only the platform admin can change plans and prices." />;

  const supabase = createClient();
  const [{ data: plans }, { data: modules }, { data: subs }] = await Promise.all([
    supabase.from("plans").select("*").in("key", [...EDITABLE_PLANS]),
    supabase.from("plan_modules").select("plan_key, module_key").in("plan_key", [...EDITABLE_PLANS]),
    supabase.from("church_subscriptions").select("plan_key"),
  ]);
  const yearlySupported = (plans ?? []).some((p) => "yearly_price" in p);
  const rows: PlanRow[] = EDITABLE_PLANS.flatMap((key) => {
    const p = (plans ?? []).find((x) => x.key === key);
    if (!p) return [];
    return [
      {
        ...p,
        modules: (modules ?? []).filter((m) => m.plan_key === key).map((m) => m.module_key),
        churches: (subs ?? []).filter((s) => s.plan_key === key).length,
      } as PlanRow,
    ];
  });
  const monthly = planCodesFromEnv();
  const yearly = planCodesFromEnv(process.env, "yearly");
  const missing = (["basic", "premium", "enterprise"] as const).flatMap((k) => [
    ...(monthly[k] ? [] : [`PAYSTACK_PLAN_${k.toUpperCase()}`]),
    ...(yearlySupported && !yearly[k] ? [`PAYSTACK_PLAN_${k.toUpperCase()}_YEARLY`] : []),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/super-admin", label: "Platform admin" }}
        title="Plans & prices"
        description="What each plan costs and includes. Changes show on every church's Billing page straight away."
      />
      {!yearlySupported && <Alert tone="info">Run supabase/plans_v3.sql to add yearly prices and the Unlimited plan.</Alert>}
      {missing.length > 0 && (
        <Alert tone="warning" title="Some online payments aren't set up">
          Churches can only pay online for a plan once it has a Paystack plan. Create these in Paystack (Payments → Plans, in rand, monthly or annually) and
          add each plan code to Vercel: {missing.join(", ")}.
        </Alert>
      )}
      {rows.map((plan) => (
        <PlanForm key={plan.key} plan={plan} yearlySupported={yearlySupported} />
      ))}
    </div>
  );
}
