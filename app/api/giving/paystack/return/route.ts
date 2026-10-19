import { NextResponse, type NextRequest } from "next/server";
import { settlePaystackGift } from "@/lib/card-giving";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/giving/paystack/return?reference=gb-… — where Paystack sends the
 * member after paying (it adds `reference` and `trxref`).
 *
 * Asks Paystack what happened (settlePaystackGift never trusts the URL) and
 * redirects to /dashboard/giving?card=received|failed|pending|unconfirmed.
 * Works without the webhook, so card giving can be tested on localhost.
 * The reference is an unguessable gift id; nothing personal is returned.
 */
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref") ?? "";
  let result = "unconfirmed";
  try {
    const outcome = await settlePaystackGift(reference);
    if (outcome === "received" || outcome === "already_received") result = "received";
    else if (outcome === "failed" || outcome === "already_failed") result = "failed";
    else if (outcome === "pending") result = "pending";
  } catch (error) {
    // Paystack unreachable, etc. The webhook will still settle it later.
    console.error("[giving] return check failed:", error instanceof Error ? error.message : error);
  }
  return NextResponse.redirect(`${APP_URL}/dashboard/giving?card=${result}`, { status: 303 });
}
