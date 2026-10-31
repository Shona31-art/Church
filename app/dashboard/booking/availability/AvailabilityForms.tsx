"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { addAvailabilityBlock, removeAvailabilityBlock } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";

export function AddBlockForm({ pastors, today }: { pastors: { id: string; name: string }[] | null; today: string }) {
  const [state, formAction] = useFormState(addAvailabilityBlock, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");

  // Clear the inputs after a successful save so the next date starts fresh.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      showToast(until && until !== from ? "Dates blocked." : "Date blocked.");
      setFrom("");
      setUntil("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card-elevated rounded-2xl p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <FormField label="Away from" htmlFor="blocked_date" required>
            <input
              id="blocked_date"
              type="date"
              name="blocked_date"
              min={today}
              required
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (until && until < e.target.value) setUntil(e.target.value);
              }}
              className="input"
            />
          </FormField>
          <FormField label="Until" htmlFor="until_date" optional>
            <input id="until_date" type="date" name="until_date" min={from || today} value={until} onChange={(e) => setUntil(e.target.value)} className="input" />
          </FormField>
        </div>
        <p className="hint -mt-2 sm:col-span-2">Leave “Until” empty for a single day. Both days are included.</p>
        <FormField label="Note" htmlFor="note" optional>
          <input id="note" name="note" maxLength={200} placeholder="e.g. On leave" className="input" />
        </FormField>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <PendingButton pendingLabel="Saving…">{until && from && until !== from ? "Block these dates" : "Block date"}</PendingButton>
    </form>
  );
}

export function RemoveBlockForm({ ids, label }: { ids: string[]; label: string }) {
  const [state, formAction] = useFormState(removeAvailabilityBlock, null);
  return (
    <form action={formAction} className="text-right">
      {ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <ConfirmSubmitButton
        title={ids.length > 1 ? "Remove these blocked dates?" : "Remove this blocked date?"}
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
