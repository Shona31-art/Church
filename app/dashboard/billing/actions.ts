"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { disableSubscription, initializeSubscriptionCheckout } from "@/lib/paystack";
import { onlineBillingConfigured } from "@/lib/subscription-billing";
import { billingReference, onlineBillingState, planCodesFromEnv, priceToCents, SELF_SERVE_PLANS, type BillingInterval } from "@/lib/billing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Starts paying for a plan online: records a pending payment, then sends the
 * church admin to Paystack's checkout. The plan only changes once Paystack
 * confirms the payment (return page or webhook — lib/subscription-billing.ts).
 */
export async function startSubscription(formData: FormData) {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "manageBilling")) {
    flash("Only church admins can manage billing.", "error");
    redirect("/dashboard/billing");
  }
  const plan = z.enum(SELF_SERVE_PLANS).safeParse(formData.get("plan"));
  const interval: BillingInterval = formData.get("interval") === "yearly" ? "yearly" : "monthly";
  const planCode = plan.success ? planCodesFromEnv(process.env, interval)[plan.data] : undefined;
  if (!plan.success || !planCode || !onlineBillingConfigured()) {
    flash("Online payment isn't available for that plan. Open a support ticket and we'll set it up for you.", "error");
    redirect("/dashboard/billing");
  }

  const admin = createAdminClient();
  const [{ data: sub }, { data: planRow }] = await Promise.all([
    admin.from("church_subscriptions").select("is_lifetime, price_override, paystack_subscription_code, cancelled_at, plan_key").eq("church_id", me.church_id).maybeSingle(),
    admin.from("plans").select("*").eq("key", plan.data).maybeSingle(),
  ]);
  const state = onlineBillingState(sub);
  if (state === "arranged") {
    flash("Your plan is arranged with the Grace-bound Ventures team. Open a support ticket to change it.", "info");
    redirect("/dashboard/billing");
  }
  if (state === "subscribed") {
    flash("You already pay online. To change plan, cancel the current subscription first, then choose the new plan.", "info");
    redirect("/dashboard/billing");
  }
  const price = interval === "yearly" ? planRow?.yearly_price : planRow?.monthly_price;
  const amountCents = price ? priceToCents(price) : 0;
  if (amountCents <= 0) {
    flash("That plan has no price set yet. Open a support ticket and we'll set it up for you.", "error");
    redirect("/dashboard/billing");
  }

  const paymentId = randomUUID();
  const reference = billingReference(paymentId);
  const { error: insertError } = await admin.from("billing_payments").insert({
    id: paymentId,
    church_id: me.church_id,
    plan_key: plan.data,
    amount_cents: amountCents,
    reference,
    started_by: me.id,
    ...(interval === "yearly" ? { interval } : {}),
  });
  if (insertError) {
    console.error("[billing] pending payment failed:", insertError.message);
    flash("Couldn't start the payment — please try again. You haven't been charged.", "error");
    redirect("/dashboard/billing");
  }

  let authorizationUrl: string;
  try {
    ({ authorizationUrl } = await initializeSubscriptionCheckout({
      email: me.email,
      amountCents,
      reference,
      callbackUrl: `${APP_URL}/api/billing/paystack/return`,
      planCode,
      metadata: { billing_payment_id: paymentId, church_id: me.church_id, plan: plan.data, interval },
    }));
  } catch (error) {
    console.error("[billing] Paystack initialize failed:", error instanceof Error ? error.message : error);
    await admin.from("billing_payments").update({ status: "failed" }).eq("id", paymentId);
    flash("We couldn't reach the payment provider. You haven't been charged — please try again in a minute.", "error");
    redirect("/dashboard/billing");
  }
  redirect(authorizationUrl);
}

/** Stops future charges. Access continues until the end of the period already paid for. */
export async function cancelSubscription() {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "manageBilling")) {
    flash("Only church admins can manage billing.", "error");
    redirect("/dashboard/billing");
  }
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("church_subscriptions")
    .select("paystack_subscription_code, paystack_email_token, cancelled_at, billing_date")
    .eq("church_id", me.church_id)
    .maybeSingle();
  if (!sub?.paystack_subscription_code || !sub.paystack_email_token || sub.cancelled_at) {
    flash("There's no online subscription to cancel.", "info");
    redirect("/dashboard/billing");
  }
  try {
    await disableSubscription(sub.paystack_subscription_code, sub.paystack_email_token);
  } catch (error) {
    console.error("[billing] Paystack disable failed:", error instanceof Error ? error.message : error);
    flash("We couldn't reach the payment provider, so nothing was cancelled. Please try again in a minute.", "error");
    redirect("/dashboard/billing");
  }
  await admin.from("church_subscriptions").update({ cancelled_at: new Date().toISOString() }).eq("church_id", me.church_id);
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "billing.cancelled", targetTable: "church_subscriptions", targetId: me.church_id });
  revalidatePath("/dashboard/billing");
  flash("Subscription cancelled. You won't be charged again, and your plan stays active until the end of the time you've paid for.");
  redirect("/dashboard/billing");
}
