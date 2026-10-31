// Billing rules shared by the billing page, plan changes and online
// subscriptions (docs/plans/paystack-billing.md). Pure — unit-tested in
// tests/unit/paystack-billing.test.ts.

/** Plans shown to church admins on the Billing page (others are arranged by the platform team). */
export const SELF_SERVE_PLANS = ["basic", "premium", "enterprise"] as const;
export type SelfServePlan = (typeof SELF_SERVE_PLANS)[number];

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Days a church keeps access after a renewal payment fails, while Paystack retries. */
export const PAYMENT_GRACE_DAYS = 7;

/** Subscription checkout references: "gbsub-" + the payment row's id. */
export const billingReference = (paymentId: string) => `gbsub-${paymentId}`;
export const isBillingReference = (reference: string) => /^gbsub-[0-9a-f-]{36}$/.test(reference);

/**
 * Paystack plan codes (PLN_…) from the environment, one per self-serve plan:
 * PAYSTACK_PLAN_BASIC (monthly) and PAYSTACK_PLAN_BASIC_YEARLY (yearly), etc.
 * Online billing is offered for a plan and interval only when its code is set.
 */
export function planCodesFromEnv(env: Record<string, string | undefined> = process.env, interval: BillingInterval = "monthly"): Partial<Record<SelfServePlan, string>> {
  const codes: Partial<Record<SelfServePlan, string>> = {};
  for (const plan of SELF_SERVE_PLANS) {
    const code = env[`PAYSTACK_PLAN_${plan.toUpperCase()}${interval === "yearly" ? "_YEARLY" : ""}`]?.trim();
    if (code && /^PLN_[A-Za-z0-9]+$/.test(code)) codes[plan] = code;
  }
  return codes;
}

/** Which of our plans a Paystack plan code belongs to (null = not one of ours). */
export function planForCode(code: string | undefined, codes: Partial<Record<SelfServePlan, string>>): SelfServePlan | null {
  if (!code) return null;
  return (Object.entries(codes).find(([, c]) => c === code)?.[0] as SelfServePlan | undefined) ?? null;
}

/** Which plan and interval a Paystack plan code belongs to (null = not one of ours). */
export function planIntervalForCode(code: string | undefined, env: Record<string, string | undefined> = process.env): { plan: SelfServePlan; interval: BillingInterval } | null {
  for (const interval of BILLING_INTERVALS) {
    const plan = planForCode(code, planCodesFromEnv(env, interval));
    if (plan) return { plan, interval };
  }
  return null;
}

/** Rand price (numeric from Postgres, e.g. "299.00") to cents. */
export const priceToCents = (price: number | string) => Math.round(Number(price) * 100);

/**
 * Same day next month, clamped to the month's last day (31 Jan → 28/29 Feb),
 * which is how Paystack schedules monthly charges.
 */
export function addOneMonth(from: Date): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Same date next year (29 Feb → 28 Feb). */
export function addOneYear(from: Date): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * When a newly paid month (or year) ends: one period after the later of "now"
 * and the current paid-up date, so paying early (or a renewal arriving a day
 * early) never shortens the time already paid for.
 */
export function nextPeriodEnd(currentBillingDate: string | null, now: Date = new Date(), interval: BillingInterval = "monthly"): Date {
  const current = currentBillingDate ? new Date(currentBillingDate) : null;
  const from = current && current > now ? current : now;
  return interval === "yearly" ? addOneYear(from) : addOneMonth(from);
}

export interface PendingBillingPayment {
  id: string;
  status: string;
  plan_key: string;
  amount_cents: number;
  reference: string;
}

export interface VerifiedBillingTx {
  status: string;
  amountCents: number;
  currency: string;
  reference: string;
  metadata: Record<string, unknown>;
  planCode?: string;
}

export type BillingSettlement = "paid" | "failed" | "pending" | "already_settled" | "not_found" | "mismatch";

/** Pure decision for a checkout started in the app: only an exact match activates a plan. */
export function decideBillingPayment(payment: PendingBillingPayment | null, tx: VerifiedBillingTx, expectedPlanCode: string | undefined): BillingSettlement {
  if (!payment) return "not_found";
  if (payment.status !== "pending") return "already_settled";
  if (tx.status === "success") {
    const matches =
      tx.currency === "ZAR" &&
      tx.amountCents === payment.amount_cents &&
      tx.reference === payment.reference &&
      String(tx.metadata.billing_payment_id ?? "") === payment.id &&
      Boolean(expectedPlanCode) &&
      tx.planCode === expectedPlanCode;
    return matches ? "paid" : "mismatch";
  }
  if (["failed", "abandoned", "reversed"].includes(tx.status)) return "failed";
  return "pending";
}

/** What the Billing page offers a church, given its subscription row. */
export function onlineBillingState(sub: {
  is_lifetime?: boolean | null;
  price_override?: number | string | null;
  paystack_subscription_code?: string | null;
  cancelled_at?: string | null;
} | null): "subscribed" | "cancelled" | "arranged" | "available" {
  if (sub?.is_lifetime || (sub?.price_override !== null && sub?.price_override !== undefined)) return "arranged";
  if (sub?.paystack_subscription_code && !sub.cancelled_at) return "subscribed";
  if (sub?.cancelled_at) return "cancelled";
  return "available";
}
