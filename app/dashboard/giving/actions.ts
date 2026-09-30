"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { getStripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function startGivingCheckout(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Not signed in." };

  const amountRand = parseFloat(String(formData.get("amount") || "0"));
  const fund = String(formData.get("fund") || "general");

  if (!amountRand || amountRand <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err: any) {
    return { error: "Online giving isn't configured yet — contact your church admin." };
  }

  // Uses the admin client to insert a 'pending' row — this is a direct
  // insert bypassing RLS (see giving_schema.sql: ordinary users have no
  // insert policy, since a giving row's existence and status should only
  // ever be created/confirmed by trusted server code, not a raw client call).
  const admin = createAdminClient();
  const amountCents = Math.round(amountRand * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: me.email,
    line_items: [
      {
        price_data: {
          currency: "zar",
          product_data: { name: `Giving — ${fund.replace("_", " ")}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${APP_URL}/dashboard/giving?given=success`,
    cancel_url: `${APP_URL}/dashboard/giving?given=cancelled`,
    metadata: { type: "donation", church_id: me.church_id!, user_id: me.id, fund },
  });

  await admin.from("givings").insert({
    church_id: me.church_id,
    user_id: me.id,
    amount_cents: amountCents,
    currency: "zar",
    fund,
    stripe_checkout_session_id: session.id,
    status: "pending",
  });

  if (session.url) redirect(session.url);
  return { error: "Stripe didn't return a checkout URL — try again." };
}
