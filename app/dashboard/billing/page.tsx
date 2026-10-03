import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getChurchAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { MODULE_LABELS, PLAN_LABELS, type ModuleKey } from "@/lib/subscription";
import { SELF_SERVE_PLANS } from "@/lib/billing";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { PermissionDenied } from "@/components/ui/Gates";
import { PlanButton, PortalButton } from "./BillingButtons";

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  trial: { tone: "info", label: "Free trial" },
  grace: { tone: "warning", label: "Payment overdue" },
  payment_pending: { tone: "warning", label: "Payment pending" },
  suspended: { tone: "danger", label: "Suspended" },
  none: { tone: "neutral", label: "No subscription" },
};

export default async function BillingPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageBilling")) {
    return <PermissionDenied message="Only church admins can manage billing." />;
  }

  const supabase = createClient();
  const [access, { data: sub }, { data: plans }, { data: planModules }, { count: activeMembers }] = await Promise.all([
    getChurchAccess(),
    supabase.from("church_subscriptions").select("*").eq("church_id", me.church_id).maybeSingle(),
    supabase.from("plans").select("key, name, monthly_price, member_limit, description").in("key", [...SELF_SERVE_PLANS]),
    supabase.from("plan_modules").select("plan_key, module_key").in("plan_key", [...SELF_SERVE_PLANS]),
    supabase.from("app_users").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).neq("status", "disabled"),
  ]);

  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const status = access?.status ?? "none";
  const sorted = [...(plans ?? [])].sort((a, b) => Number(a.monthly_price) - Number(b.monthly_price));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Billing" description="Your church's plan, payment details and invoices." />

      {searchParams.checkout === "success" && <Alert tone="success" title="Payment received">Your plan updates as soon as Stripe confirms it — usually within a few seconds. Refresh if it hasn&apos;t changed.</Alert>}
      {searchParams.checkout === "cancelled" && <Alert tone="info">Checkout cancelled — nothing was charged.</Alert>}
      {!stripeReady && (
        <Alert tone="warning" title="Online payments aren't set up yet">
          Plan changes are handled by the platform team for now. <Link href="/dashboard/support/new" className="underline">Open a support ticket</Link> to change plans.
        </Alert>
      )}

      <Section title="Current plan" actions={sub?.stripe_customer_id && stripeReady ? <PortalButton /> : null}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="text-xl font-semibold">{sub ? PLAN_LABELS[sub.plan_key] ?? sub.plan_key : "No plan"}</p>
          <StatusBadge tone={STATUS[status]?.tone ?? "neutral"}>{STATUS[status]?.label ?? status}</StatusBadge>
          {sub?.is_lifetime && <StatusBadge tone="info">Lifetime access</StatusBadge>}
        </div>
        <DetailList
          items={[
            { label: "Active members", value: String(activeMembers ?? 0) },
            ...(status === "trial" && sub?.trial_expires_at ? [{ label: "Trial ends", value: `${formatDate(sub.trial_expires_at)} (${access?.trialDaysLeft ?? 0} days left)` }] : []),
            ...(status === "grace" && sub?.grace_period_end ? [{ label: "Access until", value: formatDate(sub.grace_period_end) }] : []),
          ]}
        />
        {status === "grace" && <Alert tone="warning" className="mt-4">Your last payment didn&apos;t go through. Update your card under “Payment method & invoices” to avoid interruption.</Alert>}
        {status === "suspended" && <Alert tone="error" className="mt-4">Your subscription has ended, so most features are paused. Your data is kept safe. Choose a plan below to restore access.</Alert>}
      </Section>

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-lg font-semibold mb-3">
          Plans
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((plan) => {
            const features = (planModules ?? []).filter((m) => m.plan_key === plan.key).map((m) => MODULE_LABELS[m.module_key as ModuleKey] ?? m.module_key);
            const current = sub?.plan_key === plan.key && status !== "suspended";
            const price = `${formatMoney(Math.round(Number(plan.monthly_price) * 100))}/month`;
            return (
              <article key={plan.key} className={`card-elevated rounded-2xl p-5 flex flex-col ${current ? "ring-2 ring-ember" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {current && <StatusBadge tone="success">Current plan</StatusBadge>}
                </div>
                <p className="text-2xl font-semibold tabular-nums mt-2">{price}</p>
                <p className="text-sm text-ink/60 mt-1">{plan.member_limit ? `Up to ${plan.member_limit} active members` : "Unlimited members"}</p>
                {plan.description && <p className="text-sm text-ink/70 mt-2">{plan.description}</p>}
                <ul className="mt-4 space-y-1 text-sm flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="text-success">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {current ? (
                    <p className="text-sm text-ink/60">You&apos;re on this plan.</p>
                  ) : stripeReady ? (
                    <PlanButton planKey={plan.key} planName={plan.name} price={price} hasSubscription={Boolean(sub?.stripe_subscription_id) && status !== "suspended"} />
                  ) : (
                    <Link href="/dashboard/support/new" className="btn-secondary w-full">
                      Ask to switch
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="text-xs text-ink/60 mt-4">
          Need more than one campus or custom terms? <Link href="/dashboard/support/new" className="link">Contact us about Enterprise</Link>.
        </p>
      </section>
    </div>
  );
}
