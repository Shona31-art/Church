"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { SELF_SERVE_PLANS } from "@/lib/billing";
import { FormState, SESSION_EXPIRED } from "@/lib/forms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const STRIPE_DOWN = "We couldn't reach the payment provider. Nothing has changed — please try again in a minute.";

/**
 * Subscribe or change plan. Form fields: plan_key ("basic" | "premium").
 *
 * - No Stripe subscription yet → Stripe Checkout (card details on Stripe).
 * - Already subscribed → the existing subscription's price is changed in
 *   place, prorated. (Opening a second Checkout would start a SECOND
 *   subscription and bill the church twice.)
 * The plan itself only changes when Stripe's signed webhook confirms it.
 */
export async function changePlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!can(me.role, "manageBilling")) return { error: "Only church admins can manage billing." };

  const planKey = z.enum(SELF_SERVE_PLANS).safeParse(formData.get("plan_key"));
  if (!planKey.success) return { error: "Choose a plan." };
  const priceId = STRIPE_PRICE_IDS[planKey.data];
  if (!priceId) return { error: "This plan isn't available for online payment yet — contact support." };

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Online billing isn't set up yet — contact support to change plans." };
  }

  const supabase = createClient();
  const [{ data: church }, { data: sub }] = await Promise.all([
    supabase.from("churches").select("name, email").eq("id", me.church_id).single(),
    supabase.from("church_subscriptions").select("plan_key, stripe_customer_id, stripe_subscription_id").eq("church_id", me.church_id).single(),
  ]);
  if (sub?.plan_key === planKey.data && sub.stripe_subscription_id) return { error: "You're already on this plan." };

  let checkoutUrl: string | null = null;
  try {
    if (sub?.stripe_subscription_id) {
      const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      if (!["canceled", "incomplete_expired"].includes(current.status)) {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          items: [{ id: current.items.data[0].id, price: priceId }],
          proration_behavior: "create_prorations",
          metadata: { church_id: me.church_id, plan_key: planKey.data },
        });
        await logAudit({ churchId: me.church_id, actorId: me.id, action: "subscription.plan_change_requested", metadata: { to: planKey.data } });
        revalidatePath("/dashboard/billing");
        flash("Plan change requested. It takes effect as soon as Stripe confirms it — usually within seconds.");
        return { ok: true };
      }
    }

    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: church?.email || me.email, name: church?.name, metadata: { church_id: me.church_id } });
      customerId = customer.id;
      // Saved now so a retry doesn't create a second Stripe customer.
      // Service role: only super admins may write church_subscriptions via RLS
      // (the original code used the user client here and silently failed).
      await createAdminClient().from("church_subscriptions").update({ stripe_customer_id: customerId }).eq("church_id", me.church_id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${APP_URL}/dashboard/billing?checkout=cancelled`,
      metadata: { church_id: me.church_id, plan_key: planKey.data },
      subscription_data: { metadata: { church_id: me.church_id, plan_key: planKey.data } },
    });
    checkoutUrl = session.url;
  } catch (error) {
    console.error("[billing] plan change failed:", error instanceof Error ? error.message : error);
    return { error: STRIPE_DOWN };
  }
  if (!checkoutUrl) return { error: STRIPE_DOWN };
  redirect(checkoutUrl);
}

/** Opens Stripe's customer portal (payment method, invoices, cancel). */
export async function openBillingPortal(_prev: FormState): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!can(me.role, "manageBilling")) return { error: "Only church admins can manage billing." };

  const { data: sub } = await createClient().from("church_subscriptions").select("stripe_customer_id").eq("church_id", me.church_id).single();
  if (!sub?.stripe_customer_id) return { error: "There's no payment account yet — subscribe to a plan first." };

  let url: string;
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${APP_URL}/dashboard/billing` });
    url = session.url;
  } catch (error) {
    console.error("[billing] portal failed:", error instanceof Error ? error.message : error);
    return { error: STRIPE_DOWN };
  }
  redirect(url);
}
