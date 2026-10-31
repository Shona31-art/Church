import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { fetchSubscription, paystackConfigured, verifyTransaction } from "@/lib/paystack";
import {
  decideBillingPayment,
  isBillingReference,
  nextPeriodEnd,
  PAYMENT_GRACE_DAYS,
  planCodesFromEnv,
  planIntervalForCode,
  type BillingInterval,
  type BillingSettlement,
  type PendingBillingPayment,
} from "@/lib/billing";

// Online billing: the one place a church's subscription changes because of a
// Paystack payment. Called by the return page and the signed webhook —
// whichever comes first does the work. As with card giving, nothing in a
// URL or webhook body is trusted on its own: we ask Paystack (verify the
// transaction / read the subscription) and check it against what we expect.

export function onlineBillingConfigured(): boolean {
  return paystackConfigured() && Object.keys(planCodesFromEnv()).length + Object.keys(planCodesFromEnv(process.env, "yearly")).length > 0;
}

/** A checkout started on the Billing page: activates (or renews) the plan once Paystack confirms it. */
export async function settleBillingCheckout(reference: string): Promise<BillingSettlement | "already_paid" | "already_failed"> {
  if (!isBillingReference(reference)) return "not_found";
  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("billing_payments")
    .select("*") // includes "interval" once plans_v3.sql has run
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(`billing payment lookup failed: ${error.message}`);
  if (!payment) return "not_found";
  if (payment.status === "succeeded") return "already_paid";
  if (payment.status !== "pending") return "already_failed";

  const tx = await verifyTransaction(reference);
  const interval: BillingInterval = payment.interval === "yearly" ? "yearly" : "monthly";
  const codes = planCodesFromEnv(process.env, interval);
  const outcome = decideBillingPayment(payment as PendingBillingPayment, tx, codes[payment.plan_key as keyof typeof codes]);

  if (outcome === "failed") {
    await admin.from("billing_payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
  }
  if (outcome === "mismatch") {
    console.error("[billing] Paystack success did not match the recorded checkout — left pending for review", {
      paymentId: payment.id,
      expectedCents: payment.amount_cents,
      paidCents: tx.amountCents,
      planCode: tx.planCode,
    });
  }
  if (outcome !== "paid") return outcome;

  const { data: sub } = await admin.from("church_subscriptions").select("billing_date, plan_key").eq("church_id", payment.church_id).maybeSingle();
  // A different plan starts its period now; the same plan extends what's already paid.
  const periodEnd = nextPeriodEnd(sub?.plan_key === payment.plan_key ? sub?.billing_date ?? null : null, new Date(), interval);
  const now = new Date().toISOString();

  const { data: claimed, error: claimError } = await admin
    .from("billing_payments")
    .update({ status: "succeeded", paid_at: now, period_end: periodEnd.toISOString() })
    .eq("id", payment.id)
    .eq("status", "pending") // the other path may have just done it
    .select("id");
  if (claimError) throw new Error(`billing payment update failed: ${claimError.message}`);
  if (!claimed?.length) return "already_paid";

  const { error: subError } = await admin
    .from("church_subscriptions")
    .update({
      plan_key: payment.plan_key,
      status: "active",
      billing_date: periodEnd.toISOString(),
      grace_period_end: null,
      suspended_at: null,
      cancelled_at: null,
      ...("interval" in payment ? { billing_interval: interval } : {}),
      ...(tx.customerCode ? { paystack_customer_code: tx.customerCode } : {}),
    })
    .eq("church_id", payment.church_id);
  if (subError) {
    // Put the payment back so the webhook's retry (or the next return) tries again.
    await admin.from("billing_payments").update({ status: "pending", paid_at: null, period_end: null }).eq("id", payment.id);
    throw new Error(`subscription update failed: ${subError.message}`);
  }

  await logAudit({
    churchId: payment.church_id,
    actorId: payment.started_by,
    action: "billing.subscribed",
    targetTable: "church_subscriptions",
    targetId: payment.church_id,
    metadata: { plan: payment.plan_key, amount_cents: payment.amount_cents, paid_until: periodEnd.toISOString() },
  });
  return "paid";
}

/**
 * A monthly renewal Paystack charged by itself (charge.success with its own
 * reference). Verified with Paystack, matched to the church by customer
 * code, recorded once (the reference is unique), and the paid-up date moves on a month.
 */
export async function recordRenewal(reference: string): Promise<"renewed" | "ignored" | "duplicate"> {
  if (!reference || isBillingReference(reference) || reference.startsWith("gb-")) return "ignored";
  const tx = await verifyTransaction(reference);
  const match = planIntervalForCode(tx.planCode);
  if (tx.status !== "success" || tx.currency !== "ZAR" || !match || !tx.customerCode) return "ignored";
  const { plan, interval } = match;

  const admin = createAdminClient();
  const { data: sub, error } = await admin
    .from("church_subscriptions")
    .select("church_id, billing_date")
    .eq("paystack_customer_code", tx.customerCode)
    .maybeSingle();
  if (error) throw new Error(`subscription lookup failed: ${error.message}`);
  if (!sub) {
    console.error("[billing] renewal for a customer we don't know — ignored", { customerCode: tx.customerCode });
    return "ignored";
  }

  const periodEnd = nextPeriodEnd(sub.billing_date, new Date(), interval);
  const { error: insertError } = await admin.from("billing_payments").insert({
    ...(interval === "yearly" ? { interval } : {}),
    church_id: sub.church_id,
    plan_key: plan,
    amount_cents: tx.amountCents,
    reference,
    status: "succeeded",
    kind: "renewal",
    paid_at: new Date().toISOString(),
    period_end: periodEnd.toISOString(),
  });
  if (insertError) {
    if (insertError.code === "23505") return "duplicate"; // already recorded (webhook retried)
    throw new Error(`renewal insert failed: ${insertError.message}`);
  }

  const { error: subError } = await admin
    .from("church_subscriptions")
    .update({ plan_key: plan, status: "active", billing_date: periodEnd.toISOString(), grace_period_end: null, suspended_at: null })
    .eq("church_id", sub.church_id);
  if (subError) throw new Error(`subscription renewal failed: ${subError.message}`);
  await logAudit({ churchId: sub.church_id, actorId: null, action: "billing.renewed", targetTable: "church_subscriptions", targetId: sub.church_id, metadata: { plan, amount_cents: tx.amountCents } });
  return "renewed";
}

/** subscription.create: remember the subscription (needed to cancel it later). */
export async function linkSubscription(code: string): Promise<"linked" | "ignored"> {
  if (!/^SUB_[A-Za-z0-9]+$/.test(code)) return "ignored";
  const subscription = await fetchSubscription(code);
  if (!planIntervalForCode(subscription.planCode) || !subscription.customerCode) return "ignored";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_subscriptions")
    .update({ paystack_subscription_code: subscription.subscriptionCode, paystack_email_token: subscription.emailToken, cancelled_at: null })
    .eq("paystack_customer_code", subscription.customerCode)
    .select("church_id");
  if (error) throw new Error(`subscription link failed: ${error.message}`);
  return data?.length ? "linked" : "ignored";
}

/** invoice.payment_failed: keep access for PAYMENT_GRACE_DAYS while Paystack retries the card. */
export async function markPaymentFailed(code: string): Promise<"grace" | "ignored"> {
  if (!/^SUB_[A-Za-z0-9]+$/.test(code)) return "ignored";
  const subscription = await fetchSubscription(code);
  if (subscription.status === "active") return "ignored"; // already recovered
  const admin = createAdminClient();
  const graceEnd = new Date(Date.now() + PAYMENT_GRACE_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("church_subscriptions")
    .update({ status: "grace", grace_period_end: graceEnd })
    .eq("paystack_subscription_code", code)
    .eq("status", "active") // don't restart a grace period that's already running
    .select("church_id");
  if (error) throw new Error(`grace update failed: ${error.message}`);
  if (data?.[0]) {
    await logAudit({ churchId: data[0].church_id, actorId: null, action: "billing.payment_failed", targetTable: "church_subscriptions", targetId: data[0].church_id, metadata: { grace_until: graceEnd } });
    return "grace";
  }
  return "ignored";
}

/**
 * subscription.not_renew / subscription.disable: no more charges. Access
 * continues until the paid-up date; the nightly job then ends it
 * (endCancelledSubscriptions).
 */
export async function markCancelled(code: string): Promise<"cancelled" | "ignored"> {
  if (!/^SUB_[A-Za-z0-9]+$/.test(code)) return "ignored";
  const subscription = await fetchSubscription(code);
  if (subscription.status === "active") return "ignored";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("church_subscriptions")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("paystack_subscription_code", code)
    .is("cancelled_at", null)
    .select("church_id");
  if (error) throw new Error(`cancel update failed: ${error.message}`);
  return data?.length ? "cancelled" : "ignored";
}

/** Nightly: churches that cancelled and whose paid time has run out are suspended (data kept). */
export async function endCancelledSubscriptions(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("church_subscriptions")
    .update({ status: "suspended", suspended_at: now, paystack_subscription_code: null, paystack_email_token: null })
    .not("cancelled_at", "is", null)
    .lt("billing_date", now)
    .neq("status", "suspended")
    .eq("is_lifetime", false)
    .select("church_id");
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    await logAudit({ churchId: row.church_id, actorId: null, action: "billing.ended_after_cancel", targetTable: "church_subscriptions", targetId: row.church_id });
  }
  return data?.length ?? 0;
}
