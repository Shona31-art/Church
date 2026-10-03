import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { planForStripeStatus } from "@/lib/billing";

/**
 * POST /api/stripe/webhook — Stripe events for church subscriptions and
 * member gifts.
 *
 * Not a user request: there's no session, so the signature check below is
 * what proves the call came from Stripe, and the service-role client does
 * the writes. Responses:
 *   200 handled (or a duplicate we already handled)
 *   400 bad signature
 *   500 not configured, or a database write failed — Stripe retries 500s,
 *       which is what we want when our database had a hiccup.
 */

const PURCHASABLE_PLANS = new Set(["basic", "premium"]);
const GRACE_DAYS = 14;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    // Don't echo the reason — it only helps someone probing the endpoint.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: Stripe can deliver an event more than once.
  const { error: seenError } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (seenError) {
    if (seenError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("[stripe] couldn't record event:", seenError.message);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }

  try {
    await handle(event, admin);
  } catch (error) {
    console.error(`[stripe] ${event.type} ${event.id} failed:`, error instanceof Error ? error.message : error);
    // Forget the event so Stripe's retry is processed rather than skipped.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createAdminClient>;

function must(result: { error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

async function handle(event: Stripe.Event, admin: Admin) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === "donation") {
        if (session.payment_status !== "paid") return; // e.g. EFT still clearing — wait for async_payment_succeeded
        must(
          await admin
            .from("givings")
            .update({ status: "succeeded", stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null })
            .eq("stripe_checkout_session_id", session.id),
          "giving succeeded"
        );
        return;
      }

      const churchId = session.metadata?.church_id;
      const planKey = session.metadata?.plan_key;
      if (!churchId || !planKey || !PURCHASABLE_PLANS.has(planKey) || !session.subscription) return;
      must(
        await admin
          .from("church_subscriptions")
          .update({
            plan_key: planKey,
            status: "active",
            stripe_subscription_id: String(session.subscription),
            stripe_customer_id: typeof session.customer === "string" ? session.customer : undefined,
            trial_expires_at: null,
            grace_period_end: null,
            suspended_at: null,
          })
          .eq("church_id", churchId),
        "subscription activated"
      );
      await logAudit({ churchId, actorId: null, action: "subscription.activated", metadata: { plan_key: planKey, source: "stripe" } });
      return;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === "donation") {
        must(await admin.from("givings").update({ status: "failed" }).eq("stripe_checkout_session_id", session.id).eq("status", "pending"), "giving failed");
      }
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Access continues for a grace period rather than stopping immediately.
      const graceEnd = new Date(Date.now() + GRACE_DAYS * 86_400_000).toISOString();
      must(
        await admin
          .from("church_subscriptions")
          .update({ status: "grace", grace_period_end: graceEnd })
          .eq("stripe_customer_id", String(invoice.customer))
          .neq("status", "suspended"),
        "payment failed"
      );
      return;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      must(
        await admin.from("church_subscriptions").update({ status: "active", grace_period_end: null, suspended_at: null }).eq("stripe_customer_id", String(invoice.customer)),
        "payment succeeded"
      );
      return;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const mapped = planForStripeStatus(sub.status);
      const planKey = sub.metadata?.plan_key;
      must(
        await admin
          .from("church_subscriptions")
          .update({
            ...(planKey && PURCHASABLE_PLANS.has(planKey) ? { plan_key: planKey } : {}),
            ...(mapped === "grace" ? { status: "grace", grace_period_end: new Date(Date.now() + GRACE_DAYS * 86_400_000).toISOString() } : {}),
            ...(mapped === "active" ? { status: "active", grace_period_end: null } : {}),
            ...(mapped === "suspended" ? { status: "suspended", suspended_at: new Date().toISOString() } : {}),
          })
          .eq("stripe_subscription_id", sub.id),
        "subscription updated"
      );
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      must(
        await admin.from("church_subscriptions").update({ status: "suspended", suspended_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id),
        "subscription ended"
      );
      return;
    }
  }
}
