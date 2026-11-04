// Platform admin helpers (no server imports, so they're unit-tested).
import type { SubscriptionRow } from "@/lib/subscription";
import { resolveAccountStatus } from "@/lib/subscription";

export type PlatformSub = SubscriptionRow & { billing_date?: string | null; price_override?: number | string | null; billing_interval?: string | null; cancelled_at?: string | null };

/**
 * A paying plan whose paid-up date has passed without a new payment
 * (churches paying by EFT, or a card renewal that hasn't come through).
 * Trials, sponsored, lifetime and already-suspended churches are never overdue.
 */
export function isOverdue(sub: PlatformSub, now: Date = new Date()): boolean {
  if (sub.is_lifetime || ["free_trial", "sponsored"].includes(sub.plan_key)) return false;
  if (resolveAccountStatus(sub, now) === "suspended") return false;
  return Boolean(sub.billing_date && Date.parse(sub.billing_date) < now.getTime());
}

/**
 * What a church brings in a month: its special price, or its plan's price
 * (a yearly plan counts as a twelfth). Zero for trials, sponsored and
 * suspended churches.
 */
export function monthlyValue(sub: PlatformSub, plans: Record<string, { monthly: number; yearly: number | null }>, now: Date = new Date()): number {
  const status = resolveAccountStatus(sub, now);
  if (status === "suspended" || status === "trial" || sub.is_lifetime || ["free_trial", "sponsored"].includes(sub.plan_key)) return 0;
  const yearly = sub.billing_interval === "yearly";
  if (sub.price_override != null && sub.price_override !== "") return yearly ? Number(sub.price_override) / 12 : Number(sub.price_override);
  const plan = plans[sub.plan_key];
  if (!plan) return 0;
  return yearly ? (plan.yearly ?? plan.monthly * 10) / 12 : plan.monthly;
}
