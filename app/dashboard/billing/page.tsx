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
import { Check } from "lucide-react";

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  trial: { tone: "info", label: "Free trial" },
  grace: { tone: "warning", label: "Payment overdue" },
  payment_pending: { tone: "warning", label: "Payment pending" },
  suspended: { tone: "danger", label: "Suspended" },
  none: { tone: "neutral", label: "No subscription" },
  error: { tone: "danger", label: "Couldn't verify access" },
};

export default async function BillingPage() {
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

  const status = access?.status ?? "none";
  const sorted = [...(plans ?? [])].sort((a, b) => Number(a.monthly_price) - Number(b.monthly_price));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Billing" description="Your church's plan and what it includes." />

      {/* Plan payments are arranged with the Grace-bound team for now; online
          subscriptions (Paystack) come when they're needed — ADR-0004. */}
      <Alert tone="info" title="Changing your plan">
        The Grace-bound team sets up plan changes and invoices for you. <Link href="/dashboard/support/new" className="underline">Open a support ticket</Link> or use
        &ldquo;Ask to switch&rdquo; below.
      </Alert>

      <Section title="Current plan">
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
        {status === "grace" && <Alert tone="warning" className="mt-4">Your last payment hasn&apos;t been received. Access continues for now — open a support ticket to settle it and avoid interruption.</Alert>}
        {status === "suspended" && <Alert tone="error" className="mt-4">Your subscription has ended, so most features are paused. Your data is kept safe. Ask to switch to a plan below, or open a support ticket, to restore access.</Alert>}
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
                      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {current ? (
                    <p className="text-sm text-ink/60">You&apos;re on this plan.</p>
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
