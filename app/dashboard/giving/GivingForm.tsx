"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { startGivingCheckout } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { GIVING_FUNDS, FUND_LABELS, MAX_GIFT_RAND, MIN_GIFT_RAND } from "@/lib/giving";

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export function GivingForm({ disabled }: { disabled: boolean }) {
  const [state, formAction] = useFormState(startGivingCheckout, null);
  const [amount, setAmount] = useState(state?.values?.amount ?? "250");
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
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

      <FormField label="Amount (rand)" htmlFor="amount" required error={fe.amount} hint={`Between R${MIN_GIFT_RAND} and R${MAX_GIFT_RAND.toLocaleString("en-ZA")}.`}>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="input tabular-nums"
          aria-invalid={Boolean(fe.amount)}
        />
      </FormField>

      <FormField label="Fund" htmlFor="fund" required error={fe.fund}>
        <select id="fund" name="fund" defaultValue={state?.values?.fund ?? "general"} className="input">
          {GIVING_FUNDS.map((f) => (
            <option key={f} value={f}>
              {FUND_LABELS[f]}
            </option>
          ))}
        </select>
      </FormField>

      <PendingButton className="btn-primary w-full" pendingLabel="Opening secure checkout…" disabled={disabled}>
        Give securely
      </PendingButton>
      <p className="text-xs text-ink/60 text-center">Card details are handled by Stripe. We never see or store them.</p>
    </form>
  );
}
