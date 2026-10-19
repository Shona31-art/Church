import { NextResponse, type NextRequest } from "next/server";
import { isValidWebhookSignature } from "@/lib/paystack";
import { settlePaystackGift } from "@/lib/card-giving";

/**
 * POST /api/paystack/webhook — Paystack's event notifications.
 *
 * Not a user request (no session): the x-paystack-signature HMAC of the raw
 * body, made with our secret key, is what proves it came from Paystack.
 * We don't trust the body either: for charge events we only take the
 * reference and let settlePaystackGift ask Paystack directly.
 *
 * Responses: 200 handled or ignored · 401 bad signature · 500 temporary
 * failure (Paystack retries, which is what we want).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!isValidWebhookSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const reference = event.data?.reference ?? "";
  // Only our card gifts ("gb-…"); anything else on the account is ignored.
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
