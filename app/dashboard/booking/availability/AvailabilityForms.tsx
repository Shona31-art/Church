"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { addAvailabilityBlock, removeAvailabilityBlock } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";

export function AddBlockForm({ pastors, today }: { pastors: { id: string; name: string }[] | null; today: string }) {
  const [state, formAction] = useFormState(addAvailabilityBlock, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful save so the next date starts fresh.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      showToast("Date blocked.");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card-elevated rounded-2xl p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-end">
        {pastors && (
          <FormField label="Pastor" htmlFor="pastor_id">
            <select id="pastor_id" name="pastor_id" className="input">
              {pastors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Date" htmlFor="blocked_date" required>
          <input id="blocked_date" type="date" name="blocked_date" min={today} required className="input" />
        </FormField>
        <FormField label="Note" htmlFor="note" optional>
          <input id="note" name="note" maxLength={200} placeholder="e.g. On leave" className="input" />
        </FormField>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <PendingButton pendingLabel="Saving…">Block date</PendingButton>
    </form>
  );
}

export function RemoveBlockForm({ id, label }: { id: string; label: string }) {
  const [state, formAction] = useFormState(removeAvailabilityBlock, null);
  return (
    <form action={formAction} className="text-right">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton
        title="Remove this blocked date?"
        message={`${label} will show as available again for booking requests.`}
        confirmLabel="Remove"
        pendingLabel="Removing…"
        className="btn-ghost btn-sm text-danger"
      >
        Remove<span className="sr-only"> {label}</span>
      </ConfirmSubmitButton>
      {state?.error && <p role="alert" className="text-xs text-danger mt-1">{state.error}</p>}
    </form>
  );
}
