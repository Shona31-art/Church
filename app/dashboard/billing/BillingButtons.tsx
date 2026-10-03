"use client";

import { useFormState } from "react-dom";
import { changePlan, openBillingPortal } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";

export function PlanButton({ planKey, planName, price, hasSubscription }: { planKey: string; planName: string; price: string; hasSubscription: boolean }) {
  const [state, action] = useFormState(changePlan, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="plan_key" value={planKey} />
      {hasSubscription ? (
        <ConfirmSubmitButton
          title={`Switch to ${planName}?`}
          message={`Your subscription changes to ${price}. Stripe adjusts your next invoice for the part of the month already paid.`}
          confirmLabel={`Switch to ${planName}`}
          tone="primary"
          className="btn-primary w-full"
          pendingLabel="Switching…"
        >
          Switch to {planName}
        </ConfirmSubmitButton>
      ) : (
        <PendingButton className="btn-primary w-full" pendingLabel="Opening checkout…">
          Choose {planName}
        </PendingButton>
      )}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}

export function PortalButton() {
  const [state, action] = useFormState(openBillingPortal, null);
  return (
    <form action={action} className="space-y-2">
      <PendingButton className="btn-secondary" pendingLabel="Opening…">
        Payment method & invoices
      </PendingButton>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}
