import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

// Stripe webhooks are NOT an authenticated user request — there's no
// session, no auth.uid(), so this handler uses the admin (service role)
// client throughout, the same as the church-provisioning flow. Signature
// verification (below) is what proves the request genuinely came from
// Stripe, standing in for the auth check a normal request would have.

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Signature verification failed: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Two distinct kinds of checkout share this event: a church's own
      // subscription (mode=subscription, has plan_key) and a member's
      // one-time donation (mode=payment, metadata.type === 'donation').
      // Keep them handled separately rather than assuming one shape.
      if (session.metadata?.type === "donation") {
        await admin
          .from("givings")
          .update({
            status: "succeeded",
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq("stripe_checkout_session_id", session.id);
        break;
      }

      const churchId = session.metadata?.church_id;
      const planKey = session.metadata?.plan_key;
      if (churchId && planKey && session.subscription) {
        await admin
          .from("church_subscriptions")
          .update({
            plan_key: planKey,
            status: "active",
            stripe_subscription_id: session.subscription as string,
            trial_expires_at: null,
          })
          .eq("church_id", churchId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      // Payment failed but we don't cut access immediately — grace period,
      // matching the account-state design from earlier in this build.
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 14);
      await admin
        .from("church_subscriptions")
        .update({ status: "grace", grace_period_end: gracePeriodEnd.toISOString() })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      // A successful payment (including one that resolves a prior failure)
      // clears any grace period and confirms active status.
      await admin
        .from("church_subscriptions")
        .update({ status: "active", grace_period_end: null })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await admin
        .from("church_subscriptions")
        .update({ status: "suspended" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const planKey = subscription.metadata?.plan_key;
      if (planKey) {
        await admin
          .from("church_subscriptions")
          .update({ plan_key: planKey })
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
