"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Lock } from "lucide-react";
import { startCardGift } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { GIVING_FUNDS, FUND_LABELS, MAX_GIFT_RAND, MIN_GIFT_RAND, coverFeeCents, randToCents, type CardFeeRate } from "@/lib/giving";
import { formatMoney } from "@/lib/format";

const QUICK_AMOUNTS = [100, 250, 500, 1000];

/**
 * Member: give by card through Paystack. Card details are typed on Paystack's
 * own secure page, never here. `feeRate` is null when the fee rate isn't
 * configured — then there's no "add the card fee" option, rather than a guess.
 */
export function GivingForm({ feeRate }: { feeRate: CardFeeRate | null }) {
  const [state, formAction] = useFormState(startCardGift, null);
  const [amount, setAmount] = useState(state?.values?.amount ?? "250");
  const [coverFee, setCoverFee] = useState(state?.values?.cover_fee === "on");
  const fe = state?.fieldErrors ?? {};
  const cents = randToCents(amount);
  const fee = feeRate && cents ? coverFeeCents(cents, feeRate) : 0;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <fieldset>
        <legend className="label">Choose an amount</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              aria-pressed={amount === String(a)}
              className={amount === String(a) ? "btn-primary" : "btn-secondary"}
            >
              R{a}
            </button>
          ))}
        </div>
      </fieldset>

      <FormField label="Amount (rand)" htmlFor="card_amount" required error={fe.amount} hint={`Between R${MIN_GIFT_RAND} and R${MAX_GIFT_RAND.toLocaleString("en-ZA")}.`}>
        <input
          id="card_amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="input tabular"
          aria-invalid={Boolean(fe.amount)}
        />
      </FormField>

      <FormField label="Fund" htmlFor="card_fund" required error={fe.fund}>
        <select id="card_fund" name="fund" defaultValue={state?.values?.fund ?? "general"} className="input">
          {GIVING_FUNDS.map((f) => (
            <option key={f} value={f}>
              {FUND_LABELS[f]}
            </option>
          ))}
        </select>
      </FormField>

      {feeRate && (
        <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
          <input type="checkbox" name="cover_fee" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ember" />
          <span>
            Add the card fee{fee ? <span className="tabular"> ({formatMoney(fee)})</span> : null} so my church receives the full gift
            <span className="mt-0.5 block text-xs text-ink/60">Otherwise Paystack&apos;s fee comes out of your gift.</span>
          </span>
        </label>
      )}

      <PendingButton className="btn-primary w-full" pendingLabel="Opening secure payment…">
        <Lock aria-hidden className="h-4 w-4" />
        {cents ? `Give ${formatMoney(cents + (coverFee ? fee : 0))} by card` : "Give by card"}
      </PendingButton>
      <p className="text-center text-xs text-ink/60">You&apos;ll enter your card details on Paystack&apos;s secure page. We never see or store them.</p>
    </form>
  );
}
