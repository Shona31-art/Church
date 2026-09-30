"use client";

import { useFormState, useFormStatus } from "react-dom";
import { startCheckout } from "./actions";

export function CheckoutButton({ planKey, label }: { planKey: string; label: string }) {
  const [state, formAction] = useFormState(startCheckout, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="plan_key" value={planKey} />
      <SubmitButton label={label} />
      {state?.error && <p className="text-xs text-red-600 mt-1 max-w-[180px]">{state.error}</p>}
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ember text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
    >
      {pending ? "Redirecting..." : label}
    </button>
  );
}
