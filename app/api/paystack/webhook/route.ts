import { NextResponse, type NextRequest } from "next/server";
import { isValidWebhookSignature } from "@/lib/paystack";
import { settlePaystackGift } from "@/lib/card-giving";
import { linkSubscription, markCancelled, markPaymentFailed, recordRenewal, settleBillingCheckout } from "@/lib/subscription-billing";

/**
 * POST /api/paystack/webhook — Paystack's event notifications.
 *
 * Not a user request (no session): the x-paystack-signature HMAC of the raw
 * body, made with our secret key, is what proves it came from Paystack.
 * We don't trust the body either: for charge events we only take the
 * reference and ask Paystack directly; for subscription events only the
 * subscription code, and read the subscription back from Paystack.
 *
 * Handles card gifts ("gb-…"), church subscription checkouts ("gbsub-…"),
 * monthly renewals (Paystack's own references), failed renewals and
 * cancellations (lib/subscription-billing.ts).
 *
 * Responses: 200 handled or ignored · 401 bad signature · 500 temporary
 * failure (Paystack retries, which is what we want).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!isValidWebhookSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string; subscription_code?: string; subscription?: { subscription_code?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const reference = event.data?.reference ?? "";
  const subscriptionCode = event.data?.subscription_code ?? event.data?.subscription?.subscription_code ?? "";

  // Church subscriptions (online billing).
  try {
    switch (event.event) {
      case "subscription.create":
        return NextResponse.json({ received: true, outcome: await linkSubscription(subscriptionCode) });
      case "invoice.payment_failed":
        return NextResponse.json({ received: true, outcome: await markPaymentFailed(subscriptionCode) });
      case "subscription.not_renew":
      case "subscription.disable":
        return NextResponse.json({ received: true, outcome: await markCancelled(subscriptionCode) });
      case "charge.success":
        if (reference.startsWith("gbsub-")) return NextResponse.json({ received: true, outcome: await settleBillingCheckout(reference) });
        if (!reference.startsWith("gb-")) return NextResponse.json({ received: true, outcome: await recordRenewal(reference) });
    }
  } catch (error) {
    console.error("[paystack-webhook] billing event failed:", event.event, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }

  // Card gifts ("gb-…"); anything else on the account is ignored.
  if (!event.event?.startsWith("charge.") || !reference.startsWith("gb-")) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const outcome = await settlePaystackGift(reference);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    console.error("[paystack-webhook] settle failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
}
