"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { markPrayerAnswered } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";

export function AnswerPrayerForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(markPrayerAnswered, null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm" aria-expanded={false}>
        ✓ Mark answered
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 mt-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`reflection-${id}`} className="label">
        How did God answer? <span className="font-normal text-ink/50">(optional)</span>
      </label>
      <textarea id={`reflection-${id}`} name="reflection" rows={3} maxLength={2000} className="input" />
      {state?.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <PendingButton className="btn-primary btn-sm">Save testimony</PendingButton>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
