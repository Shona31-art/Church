"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { randomUUID } from "node:crypto";
import { initializeTransaction, paystackConfigured } from "@/lib/paystack";
import { cardReference } from "@/lib/card-giving";
import { GIVING_FUNDS, MAX_GIFT_RAND, MIN_GIFT_RAND, cardFeeRateFromEnv, coverFeeCents, randToCents, transferReportSchema } from "@/lib/giving";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { todayInAppZone } from "@/lib/format";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Member: start a one-off card gift through Paystack.
 * Form fields: amount (rand), fund, cover_fee ("on" to add the card fee).
 *
 * Order matters: the pending gift is written FIRST (service role — members
 * can't insert card gifts themselves), so every Paystack payment has a record
 * to settle. A gift only becomes "received" in lib/card-giving.ts, after
 * Paystack itself confirms the payment — never from the browser.
 */
export async function startCardGift(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("giving")).allowed) return { error: "Giving isn't available for your church right now." };
  const values = formValues(formData);

  const fund = z.enum(GIVING_FUNDS).safeParse(formData.get("fund"));
  const cents = randToCents(String(formData.get("amount") ?? ""));
  if (!fund.success) return { error: "Choose a fund.", fieldErrors: { fund: "Choose a fund." }, values };
  if (cents === null || cents < MIN_GIFT_RAND * 100 || cents > MAX_GIFT_RAND * 100) {
    return { error: "Please fix the amount.", fieldErrors: { amount: `Enter an amount between R${MIN_GIFT_RAND} and R${MAX_GIFT_RAND.toLocaleString("en-ZA")}.` }, values };
  }
  if (!paystackConfigured()) return { error: "Card giving isn't available right now. You can give by bank transfer.", values };

  const admin = createAdminClient();
  const { data: card } = await admin.from("church_card_giving").select("subaccount_code, enabled").eq("church_id", me.church_id).maybeSingle();
  if (!card?.enabled) return { error: "Your church hasn't turned on card giving. You can give by bank transfer.", values };

  const rate = cardFeeRateFromEnv();
  const feeCents = formData.get("cover_fee") === "on" && rate ? coverFeeCents(cents, rate) : 0;
  const giftId = randomUUID();
  const reference = cardReference(giftId);

  const { error: insertError } = await admin.from("givings").insert({
    id: giftId,
    church_id: me.church_id,
    user_id: me.id,
    amount_cents: cents,
    fee_cents: feeCents,
    currency: "zar",
    fund: fund.data,
    method: "card",
    status: "pending",
    provider: "paystack",
    provider_reference: reference,
  });
  if (insertError) {
    console.error("[giving] pending card gift failed:", insertError.message);
    return { error: "Couldn't start your gift — please try again. You haven't been charged.", values };
  }

  let authorizationUrl: string;
  try {
    ({ authorizationUrl } = await initializeTransaction({
      email: me.email,
      amountCents: cents + feeCents,
      reference,
      callbackUrl: `${APP_URL}/api/giving/paystack/return`,
      subaccountCode: card.subaccount_code,
      metadata: { giving_id: giftId, church_id: me.church_id, fund: fund.data },
    }));
  } catch (error) {
    console.error("[giving] Paystack initialize failed:", error instanceof Error ? error.message : error);
    await admin.from("givings").update({ status: "failed" }).eq("id", giftId);
    return { error: "We couldn't reach the payment provider. You haven't been charged — please try again in a minute.", values };
  }

  redirect(authorizationUrl);
}

// ---------------------------------------------------------------------------
// Giving by bank transfer (docs/plans/eft-giving.md, migration #30). These use
// the signed-in person's own client, so the database rules apply too: members
// can only record their own transfer as "waiting", and only church admins can
// confirm one (through confirm_eft_gift).
// ---------------------------------------------------------------------------

function refreshGiving() {
  revalidatePath("/dashboard/giving");
  revalidatePath("/dashboard/giving/report");
  revalidatePath("/dashboard");
}

/** Member: "I've made a transfer". Form fields: amount (rand), fund, paid_on (YYYY-MM-DD). */
export async function reportTransfer(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("giving")).allowed) return { error: "Giving isn't available for your church right now." };

  const parsed = transferReportSchema(todayInAppZone()).safeParse({
    amount_cents: String(formData.get("amount") ?? ""),
    fund: formData.get("fund"),
    paid_on: String(formData.get("paid_on") ?? ""),
  });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    if (result?.fieldErrors?.amount_cents) result.fieldErrors.amount = result.fieldErrors.amount_cents;
    return result;
  }

  const supabase = createClient();
  const { data: details } = await supabase.from("church_giving_details").select("church_id").eq("church_id", me.church_id).maybeSingle();
  if (!details) return { error: "Your church hasn't added its bank details yet, so transfers can't be recorded.", values: formValues(formData) };

  // The reference is filled in by the database (it can't be chosen here).
  const { error } = await supabase.from("givings").insert({
    church_id: me.church_id,
    user_id: me.id,
    method: "eft",
    status: "reported",
    amount_cents: parsed.data.amount_cents,
    currency: "zar",
    fund: parsed.data.fund,
    paid_on: parsed.data.paid_on,
  });
  if (error) {
    console.error("[giving] transfer report failed:", error.message);
    return { error: "Couldn't record your gift — please try again. Nothing was saved.", values: formValues(formData) };
  }

  refreshGiving();
  flash("Thank you. Your gift is recorded and will show as received once your church confirms it arrived.");
  redirect("/dashboard/giving");
}

/** Member: remove their own transfer while it's still waiting. Form field: gift_id. */
export async function deleteMyTransfer(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("gift_id"));
  if (!id.success) return { error: "That gift couldn't be found." };

  const { data: removed, error } = await createClient()
    .from("givings")
    .delete()
    .eq("id", id.data)
    .eq("user_id", me.id)
    .eq("method", "eft")
    .eq("status", "reported")
    .select("id");
  if (error) console.error("[giving] delete transfer failed:", error.message);
  if (error || !removed?.length) return { error: "Couldn't remove it — it may already have been confirmed by your church. Refresh to see the latest." };

  refreshGiving();
  return { ok: true };
}

/**
 * Church admin: confirm a reported transfer against the bank statement.
 * Form fields: gift_id, outcome ("received" | "not_received"), amount (rand,
 * for "received"), expected_updated_at (when the admin loaded the list).
 */
export async function confirmTransfer(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };
  if (!can(me.role, "viewGivingReport")) return { error: "Only church admins can confirm gifts." };

  const id = z.string().uuid().safeParse(formData.get("gift_id"));
  const outcome = z.enum(["received", "not_received"]).safeParse(formData.get("outcome"));
  if (!id.success || !outcome.success) return { error: "That gift couldn't be found." };
  const cents = outcome.data === "received" ? randToCents(String(formData.get("amount") ?? "")) : null;
  if (outcome.data === "received" && (cents === null || cents < 100 || cents > MAX_GIFT_RAND * 100)) {
    return { error: "Enter the amount that arrived, e.g. 250 or 250.50.", fieldErrors: { amount: "Enter the amount that arrived." } };
  }

  const { data, error } = await createClient().rpc("confirm_eft_gift", {
    p_gift: id.data,
    p_outcome: outcome.data,
    p_amount_cents: cents,
    p_expected_updated_at: String(formData.get("expected_updated_at") ?? ""),
  });
  if (error) {
    console.error("[giving] confirm failed:", error.message);
    return { error: "Couldn't save that — please try again." };
  }
  if (data === "changed") {
    refreshGiving();
    return { error: "Someone else already dealt with this gift, or the member removed it. The list has been refreshed." };
  }
  if (data !== "ok") return { error: data === "invalid" ? "Enter the amount that arrived." : "That gift couldn't be found." };

  refreshGiving();
  flash(outcome.data === "received" ? "Marked as received." : "Marked as not received. The member will see this in their history.");
  return { ok: true };
}
