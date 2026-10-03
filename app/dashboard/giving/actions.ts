"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { getStripe } from "@/lib/stripe";
import { GIVING_FUNDS, FUND_LABELS, MAX_GIFT_RAND, MIN_GIFT_RAND, randToCents } from "@/lib/giving";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Starts a one-off card gift through Stripe Checkout.
 * Form fields: amount (rand), fund.
 *
 * Order matters: the pending giving row is written FIRST, so every Checkout
 * session has a record to update. A giving row only becomes "succeeded"
 * when Stripe's signed webhook says so — never from the browser.
 * The service-role client is used because members have no insert policy on
 * givings (by design); the user and church come from the session, not the form.
 */
export async function startGivingCheckout(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("giving")).allowed) return { error: "Online giving isn't available for your church right now." };

  const values = formValues(formData);
  const fund = z.enum(GIVING_FUNDS).safeParse(formData.get("fund"));
  const cents = randToCents(String(formData.get("amount") ?? ""));
  if (!fund.success) return { error: "Choose a fund.", fieldErrors: { fund: "Choose a fund." }, values };
  if (cents === null || cents < MIN_GIFT_RAND * 100 || cents > MAX_GIFT_RAND * 100) {
    return { error: "Please fix the amount.", fieldErrors: { amount: `Enter an amount between R${MIN_GIFT_RAND} and R${MAX_GIFT_RAND.toLocaleString("en-ZA")}.` }, values };
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Online giving isn't set up yet — your church admin needs to connect Stripe.", values };
  }

  const admin = createAdminClient();
  const { data: gift, error: insertError } = await admin
    .from("givings")
    .insert({ church_id: me.church_id, user_id: me.id, amount_cents: cents, currency: "zar", fund: fund.data, status: "pending" })
    .select("id")
    .single();
  if (insertError || !gift) {
    console.error("[giving] pending row failed:", insertError?.message);
    return { error: "Couldn't start your gift — please try again. You haven't been charged.", values };
  }

  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: me.email,
        line_items: [{ price_data: { currency: "zar", product_data: { name: `Gift — ${FUND_LABELS[fund.data]}` }, unit_amount: cents }, quantity: 1 }],
        success_url: `${APP_URL}/dashboard/giving?given=success`,
        cancel_url: `${APP_URL}/dashboard/giving?given=cancelled`,
        metadata: { type: "donation", giving_id: gift.id, church_id: me.church_id, user_id: me.id, fund: fund.data },
        payment_intent_data: { metadata: { giving_id: gift.id } },
      },
      // Same gift row → same session, if this request is retried.
      { idempotencyKey: `giving-${gift.id}` }
    );
    await admin.from("givings").update({ stripe_checkout_session_id: session.id }).eq("id", gift.id);
    url = session.url;
  } catch (error) {
    console.error("[giving] checkout failed:", error instanceof Error ? error.message : error);
    await admin.from("givings").update({ status: "failed" }).eq("id", gift.id);
    return { error: "We couldn't reach the payment provider. You haven't been charged — please try again in a minute.", values };
  }

  if (!url) return { error: "The payment page didn't open — please try again.", values };
  redirect(url);
}
