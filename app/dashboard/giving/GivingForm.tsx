"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { startGivingCheckout } from "./actions";

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export function GivingForm({ disabled }: { disabled: boolean }) {
  const [state, formAction] = useFormState(startGivingCheckout, null);
  const [amount, setAmount] = useState("250");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(String(a))}
            className={`flex-1 border rounded-lg py-2 text-sm ${
              amount === String(a) ? "border-ember bg-ember/5 text-ember font-semibold" : "border-ink/20"
            }`}
          >
            R{a}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-ink/40">Amount (ZAR)</label>
        <input
          type="number"
          name="amount"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
      </div>

      <select name="fund" className="w-full border border-ink/20 rounded-lg px-4 py-3">
        <option value="general">General Fund</option>
        <option value="tithe">Tithe</option>
        <option value="missions">Missions</option>
        <option value="building">Building Fund</option>
      </select>

      <SubmitButton disabled={disabled} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full bg-ember text-white py-3 rounded-lg font-medium disabled:opacity-50"
    >
      {pending ? "Redirecting to secure checkout..." : "Give now"}
    </button>
  );
}
