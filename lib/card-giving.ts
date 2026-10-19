import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction, type VerifiedTransaction } from "@/lib/paystack";

// The one place a card gift becomes "received" (or "failed"). Called when the
// member comes back from Paystack AND by the signed webhook — whichever comes
// first does the work; the other finds nothing left to do. We never trust
// what the browser or the webhook body says: we ask Paystack (verify) and
// check it against the gift we recorded before sending the member to pay.

export type Settlement = "received" | "failed" | "pending" | "already_settled" | "not_found" | "mismatch";

export interface PendingGift {
  id: string;
  status: string;
  amount_cents: number;
  fee_cents: number;
  provider_reference: string | null;
}

/** Card gift references: "gb-" + the gift's id. Only letters, digits and "-" (Paystack allows -, ., =). */
export const cardReference = (giftId: string) => `gb-${giftId}`;

/** Pure decision, unit-tested in tests/unit/card-giving.test.ts. */
export function decideSettlement(gift: PendingGift | null, tx: VerifiedTransaction): Settlement {
  if (!gift) return "not_found";
  if (gift.status !== "pending") return "already_settled";
  if (tx.status === "success") {
    const expected = gift.amount_cents + gift.fee_cents;
    const matches =
      tx.currency === "ZAR" &&
      tx.amountCents === expected &&
      tx.reference === gift.provider_reference &&
      String(tx.metadata.giving_id ?? "") === gift.id;
    return matches ? "received" : "mismatch";
  }
  if (["failed", "abandoned", "reversed"].includes(tx.status)) return "failed";
  return "pending"; // ongoing / processing / queued: check again later (webhook or next return)
}

/**
 * Verifies `reference` with Paystack and records the outcome. Idempotent:
 * only a gift still "pending" is ever changed. A "mismatch" (paid, but not
 * what we expected) is logged and left pending for a person to look at —
 * never silently marked received.
 */
export async function settlePaystackGift(reference: string): Promise<Settlement> {
  if (!/^gb-[0-9a-f-]{36}$/.test(reference)) return "not_found";
  const admin = createAdminClient();
  const { data: gift, error } = await admin
    .from("givings")
    .select("id, status, amount_cents, fee_cents, provider_reference")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (error) throw new Error(`gift lookup failed: ${error.message}`);
  if (!gift) return "not_found";
  if (gift.status !== "pending") return "already_settled";

  const tx = await verifyTransaction(reference);
  const outcome = decideSettlement(gift as PendingGift, tx);

  if (outcome === "received" || outcome === "failed") {
    const { error: updateError } = await admin
      .from("givings")
      .update({ status: outcome === "received" ? "succeeded" : "failed", confirmed_at: new Date().toISOString() })
      .eq("id", gift.id)
      .eq("status", "pending"); // the other path may have just done it
    if (updateError) throw new Error(`gift update failed: ${updateError.message}`);
  }
  if (outcome === "mismatch") {
    console.error("[card-giving] Paystack success did not match the recorded gift — left pending for review", {
      giftId: gift.id,
      expectedCents: gift.amount_cents + gift.fee_cents,
      paidCents: tx.amountCents,
      currency: tx.currency,
    });
  }
  return outcome;
}
