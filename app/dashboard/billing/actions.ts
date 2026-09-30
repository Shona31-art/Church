"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function startCheckout(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "church_admin") {
    return { error: "Only church admins can manage billing." };
  }

  const planKey = String(formData.get("plan_key") || "");
  const priceId = STRIPE_PRICE_IDS[planKey];
  if (!priceId) {
    return { error: "This plan isn't configured for checkout yet — contact support." };
  }

  const supabase = createClient();
  const { data: church } = await supabase.from("churches").select("name, email").eq("id", me.church_id).single();
  const { data: subscription } = await supabase
    .from("church_subscriptions")
    .select("stripe_customer_id")
    .eq("church_id", me.church_id)
    .single();

  let stripe;
  try {
    stripe = getStripe();
  } catch (err: any) {
    return { error: err.message };
  }

  let customerId = subscription?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: church?.email || me.email,
      name: church?.name,
      metadata: { church_id: me.church_id! },
    });
    customerId = customer.id;
    await supabase
      .from("church_subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("church_id", me.church_id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard/billing?checkout=success`,
    cancel_url: `${APP_URL}/dashboard/billing?checkout=cancelled`,
    metadata: { church_id: me.church_id!, plan_key: planKey },
    subscription_data: { metadata: { church_id: me.church_id!, plan_key: planKey } },
  });

  if (session.url) redirect(session.url);
  return { error: "Stripe didn't return a checkout URL — try again." };
}

export async function openBillingPortal() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "church_admin") return;

  const supabase = createClient();
  const { data: subscription } = await supabase
    .from("church_subscriptions")
    .select("stripe_customer_id")
    .eq("church_id", me.church_id)
    .single();

  if (!subscription?.stripe_customer_id) return;

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${APP_URL}/dashboard/billing`,
  });

  redirect(session.url);
}
