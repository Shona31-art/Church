"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { addAvailabilityBlock, removeAvailabilityBlock } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";

export function AddBlockForm({ pastors, today }: { pastors: { id: string; name: string }[] | null; today: string }) {
  const [state, formAction] = useFormState(addAvailabilityBlock, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful save so the next date starts fresh.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mb-8 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {pastors && (
          <div>
            <label htmlFor="pastor_id" className="block text-xs font-medium mb-1">Pastor</label>
            <select id="pastor_id" name="pastor_id" className="border border-ink/20 rounded-lg px-3 py-2 text-sm">
              {pastors.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="blocked_date" className="block text-xs font-medium mb-1">Date</label>
          <input id="blocked_date" type="date" name="blocked_date" min={today} required className="border border-ink/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="note" className="block text-xs font-medium mb-1">
            Note <span className="font-normal text-ink/40">(optional)</span>
          </label>
          <input id="note" name="note" maxLength={200} placeholder="e.g. Vacation" className="w-full border border-ink/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <PendingButton pendingLabel="Saving…" className="bg-ember text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
          Block date
        </PendingButton>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">⚠ {state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-green-800">✓ Date blocked.</p>}
    </form>
  );
}

export function RemoveBlockForm({ id }: { id: string }) {
  const [state, formAction] = useFormState(removeAvailabilityBlock, null);
  return (
    <form action={formAction} className="text-right">
      <input type="hidden" name="id" value={id} />
      <PendingButton pendingLabel="Removing…" className="text-xs text-red-700 disabled:opacity-50">
        Remove
      </PendingButton>
      {state?.error && <p role="alert" className="text-xs text-red-700 mt-1">⚠ {state.error}</p>}
    </form>
  );
}
