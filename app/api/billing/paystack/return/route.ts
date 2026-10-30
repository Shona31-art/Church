import { NextResponse, type NextRequest } from "next/server";
import { settleBillingCheckout } from "@/lib/subscription-billing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/billing/paystack/return?reference=gbsub-… — where Paystack sends
 * a church admin after paying for a plan (it adds `reference` and `trxref`).
 *
 * Asks Paystack what happened (never trusts the URL) and redirects to
 * /dashboard/billing?payment=paid|failed|pending|unconfirmed. Works without
 * the webhook, so billing can be tested on localhost.
 */
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref") ?? "";
  let result = "unconfirmed";
  try {
    const outcome = await settleBillingCheckout(reference);
    if (outcome === "paid" || outcome === "already_paid") result = "paid";
    else if (outcome === "failed" || outcome === "already_failed") result = "failed";
    else if (outcome === "pending") result = "pending";
  } catch (error) {
    console.error("[billing] return check failed:", error instanceof Error ? error.message : error);
  }
  return NextResponse.redirect(`${APP_URL}/dashboard/billing?payment=${result}`, { status: 303 });
}
