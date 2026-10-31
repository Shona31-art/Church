import Link from "next/link";
import { HapticOnMount } from "@/components/Haptics";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getChurchAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { MODULE_LABELS, PLAN_LABELS, type ModuleKey } from "@/lib/subscription";
import { onlineBillingState, planCodesFromEnv, SELF_SERVE_PLANS, type BillingInterval } from "@/lib/billing";
import { onlineBillingConfigured } from "@/lib/subscription-billing";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { cancelSubscription, startSubscription } from "./actions";
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

const PAYMENT_RESULT: Record<string, { tone: "success" | "error" | "info" | "warning"; title: string; body: string }> = {
  paid: { tone: "success", title: "Payment received", body: "Thank you — your plan is active. Paystack will charge the same card when it renews; you can cancel any time here." },
  failed: { tone: "error", title: "The payment didn't go through", body: "You haven't been charged. Try again, or use a different card." },
  pending: { tone: "info", title: "Payment still processing", body: "Paystack is still confirming it. This page updates automatically once it's done — usually within a few minutes." },
  unconfirmed: { tone: "warning", title: "We couldn't confirm the payment yet", body: "If you were charged, your plan will update as soon as Paystack tells us. Refresh in a few minutes, or open a support ticket." },
};

export default async function BillingPage({ searchParams }: { searchParams: { payment?: string; interval?: string } }) {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageBilling")) {
    return <PermissionDenied message="Only church admins can manage billing." />;
  }

  const supabase = createClient();
  const [access, { data: sub }, { data: plans }, { data: planModules }, { count: activeMembers }, { data: payments }] = await Promise.all([
    getChurchAccess(),
    supabase.from("church_subscriptions").select("*").eq("church_id", me.church_id).maybeSingle(),
    supabase.from("plans").select("*").in("key", [...SELF_SERVE_PLANS]),
    supabase.from("plan_modules").select("plan_key, module_key").in("plan_key", [...SELF_SERVE_PLANS]),
    supabase.from("app_users").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).neq("status", "disabled"),
    // Empty until paystack_billing.sql (#34) has been run.
    supabase.from("billing_payments").select("*").eq("church_id", me.church_id).neq("status", "pending").order("created_at", { ascending: false }).limit(12),
  ]);
  const online = onlineBillingConfigured();
  const yearlyCodes = planCodesFromEnv(process.env, "yearly");
  // Yearly is offered when at least one plan has a yearly price and a yearly Paystack plan.
  const yearlyAvailable = (plans ?? []).some((p: any) => Number(p.yearly_price) > 0 && yearlyCodes[p.key as keyof typeof yearlyCodes]);
  const interval: BillingInterval = searchParams.interval === "yearly" && yearlyAvailable ? "yearly" : "monthly";
  const planCodes = interval === "yearly" ? yearlyCodes : planCodesFromEnv();
  const billingState = onlineBillingState(sub);
  const result = searchParams.payment ? PAYMENT_RESULT[searchParams.payment] : undefined;

  const status = access?.status ?? "none";
  const sorted = [...(plans ?? [])].sort((a, b) => Number(a.monthly_price) - Number(b.monthly_price));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader back={{ href: "/dashboard", label: "Home" }} title="Billing" description="Your church's plan and what it includes." />

      {result && (
        <Alert tone={result.tone} title={result.title}>
          {searchParams.payment === "paid" && <HapticOnMount />}
          {result.body}
        </Alert>
      )}

      {/* Online billing (Paystack subscriptions) when it's configured;
          otherwise plan changes are arranged with the Grace-bound Ventures team. */}
      {!online || billingState === "arranged" ? (
        <Alert tone="info" title="Changing your plan">
          The Grace-bound Ventures team sets up plan changes and invoices for you. <Link href="/dashboard/support/new" className="underline">Open a support ticket</Link> or use
          &ldquo;Ask to switch&rdquo; below.
        </Alert>
      ) : null}

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
            ...(billingState === "subscribed" && sub?.billing_date
              ? [{ label: "Next payment", value: `${formatDate(sub.billing_date)} · ${sub.billing_interval === "yearly" ? "yearly" : "monthly"}, card via Paystack` }]
              : []),
            ...(billingState === "cancelled" && sub?.billing_date && status !== "suspended" ? [{ label: "Cancelled", value: `Active until ${formatDate(sub.billing_date)}` }] : []),
          ]}
        />
        {billingState === "subscribed" && (
          <form action={cancelSubscription} className="mt-5">
            <ConfirmSubmitButton
              title="Cancel your subscription?"
              message={`You won't be charged again. Your plan stays active until ${sub?.billing_date ? formatDate(sub.billing_date) : "the end of the time you've paid for"}, then most features pause. Your church's data is kept, and you can subscribe again any time.`}
              confirmLabel="Cancel subscription"
              className="btn-danger-outline btn-sm"
              pendingLabel="Cancelling…"
            >
              Cancel subscription
            </ConfirmSubmitButton>
          </form>
        )}
        {status === "grace" &&
          (billingState === "subscribed" ? (
            <Alert tone="warning" className="mt-4">
              Paystack couldn&apos;t charge your card and will try again over the next few days. Access continues meanwhile. To use a different card,
              cancel the subscription and subscribe again.
            </Alert>
          ) : (
            <Alert tone="warning" className="mt-4">Your last payment hasn&apos;t been received. Access continues for now — open a support ticket to settle it and avoid interruption.</Alert>
          ))}
        {status === "suspended" && <Alert tone="error" className="mt-4">Your subscription has ended, so most features are paused. Your data is kept safe. Ask to switch to a plan below, or open a support ticket, to restore access.</Alert>}
      </Section>

      <section aria-labelledby="plans-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans-heading" className="text-lg font-semibold">
            Plans
          </h2>
          {yearlyAvailable && (
            <nav aria-label="Pay monthly or yearly" className="inline-flex rounded-full border border-line bg-surface p-1 text-sm">
              <Link href="/dashboard/billing" aria-current={interval === "monthly" ? "page" : undefined} className={`rounded-full px-4 py-1.5 font-medium ${interval === "monthly" ? "bg-ember text-on-ember" : "text-ink/70"}`}>
                Monthly
              </Link>
              <Link href="/dashboard/billing?interval=yearly" aria-current={interval === "yearly" ? "page" : undefined} className={`rounded-full px-4 py-1.5 font-medium ${interval === "yearly" ? "bg-ember text-on-ember" : "text-ink/70"}`}>
                Yearly <span className={interval === "yearly" ? "opacity-80" : "text-success"}>· 2 months free</span>
              </Link>
            </nav>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {sorted.map((plan: any) => {
            const features = (planModules ?? []).filter((m) => m.plan_key === plan.key).map((m) => MODULE_LABELS[m.module_key as ModuleKey] ?? m.module_key);
            const current = sub?.plan_key === plan.key && status !== "suspended";
            const yearly = interval === "yearly" && Number(plan.yearly_price) > 0;
            const price = yearly ? `${formatMoney(Math.round(Number(plan.yearly_price) * 100))}/year` : `${formatMoney(Math.round(Number(plan.monthly_price) * 100))}/month`;
            const saving = yearly ? Math.round(Number(plan.monthly_price) * 12 - Number(plan.yearly_price)) : 0;
            return (
              <article key={plan.key} className={`card-elevated rounded-2xl p-5 flex flex-col ${current ? "ring-2 ring-ember" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {current && <StatusBadge tone="success">Current plan</StatusBadge>}
                </div>
                <p className="text-2xl font-semibold tabular-nums mt-2">{price}</p>
                {yearly && saving > 0 && <p className="text-xs font-semibold text-success">Save {formatMoney(saving * 100)} a year</p>}
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
                  {current && billingState !== "available" && billingState !== "cancelled" ? (
                    <p className="text-sm text-ink/60">You&apos;re on this plan.</p>
                  ) : online && billingState !== "arranged" && billingState !== "subscribed" && planCodes[plan.key as keyof typeof planCodes] ? (
                    <form action={startSubscription}>
                      <input type="hidden" name="plan" value={plan.key} />
                      <input type="hidden" name="interval" value={yearly ? "yearly" : "monthly"} />
                      <PendingButton className={current ? "btn-secondary w-full" : "btn-primary w-full"} pendingLabel="Opening secure checkout…">
                        {current ? `Pay online — ${price}` : `Subscribe — ${price}`}
                      </PendingButton>
                      <p className="mt-2 text-center text-xs text-ink/60">Card payment by Paystack. Cancel any time.</p>
                    </form>
                  ) : current ? (
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
      </section>

      {payments && payments.length > 0 && (
        <Section title="Payments">
          <ul className="divide-y divide-line text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">
                    {PLAN_LABELS[p.plan_key] ?? p.plan_key} · {p.kind === "renewal" ? (p.interval === "yearly" ? "Yearly renewal" : "Monthly renewal") : p.interval === "yearly" ? "Yearly subscription" : "Subscription"}
                  </p>
                  <p className="text-xs text-ink/60">
                    {formatDate(p.paid_at ?? p.created_at)}
                    {p.period_end ? ` · paid until ${formatDate(p.period_end)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular font-semibold">{formatMoney(p.amount_cents)}</span>
                  <StatusBadge tone={p.status === "succeeded" ? "success" : "danger"}>{p.status === "succeeded" ? "Paid" : "Failed"}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
