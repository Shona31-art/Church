"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { reportTransfer } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField, RequiredNote } from "@/components/ui/FormField";
import { GIVING_FUNDS, FUND_LABELS, MAX_GIFT_RAND } from "@/lib/giving";

const QUICK_AMOUNTS = [100, 250, 500, 1000];

/** Member: record a gift they've paid (bank transfer, PayShap or the church's link). It shows as "waiting" until a church admin confirms it. */
export function TransferForm({ today, channels = [{ value: "bank", label: "Bank transfer" }] }: { today: string; channels?: { value: string; label: string }[] }) {
  const [state, action] = useFormState(reportTransfer, null);
  const fe = state?.fieldErrors ?? {};
  const [amount, setAmount] = useState(state?.values?.amount ?? "");

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />

      <fieldset>
        <legend className="label">How much did you give?</legend>
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

      <FormField label="Amount (rand)" htmlFor="amount" required error={fe.amount} hint={`Up to R${MAX_GIFT_RAND.toLocaleString("en-ZA")}.`}>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="e.g. 250"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="input tabular"
          aria-invalid={Boolean(fe.amount)}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Fund" htmlFor="fund" required error={fe.fund}>
          <select id="fund" name="fund" defaultValue={state?.values?.fund ?? "general"} className="input" aria-invalid={Boolean(fe.fund)}>
            {GIVING_FUNDS.map((f) => (
              <option key={f} value={f}>
                {FUND_LABELS[f]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Date paid" htmlFor="paid_on" required error={fe.paid_on}>
          <input
            id="paid_on"
            name="paid_on"
            type="date"
            max={today}
            defaultValue={state?.values?.paid_on ?? today}
            required
            className="input tabular"
            aria-invalid={Boolean(fe.paid_on)}
          />
        </FormField>
      </div>

      {channels.length > 1 ? (
        <fieldset>
          <legend className="label">How did you pay?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {channels.map((c, i) => (
              <label key={c.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-ember has-[:checked]:bg-ember/10">
                <input type="radio" name="channel" value={c.value} defaultChecked={(state?.values?.channel ?? channels[0].value) === c.value || (!state?.values?.channel && i === 0)} className="h-4 w-4" />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="channel" value="bank" />
      )}

      <PendingButton className="btn-primary w-full" pendingLabel="Recording…">
        I&apos;ve paid — record my gift
      </PendingButton>
      <p className="text-center text-xs text-ink/60">This only records your gift. The money moves in your own banking app; no card details are involved.</p>
    </form>
  );
}
