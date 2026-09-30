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
      <button onClick={() => setOpen(true)} className="text-xs text-green-800 border border-green-800/30 rounded-lg px-3 py-1.5 hover:bg-green-50">
        ✓ Mark answered
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 mt-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`reflection-${id}`} className="block text-xs font-medium">How did God answer? (optional)</label>
      <textarea id={`reflection-${id}`} name="reflection" rows={3} maxLength={2000} className="w-full border border-ink/20 rounded-lg px-3 py-2 text-sm" />
      {state?.error && <p role="alert" className="text-xs text-red-700">⚠ {state.error}</p>}
      <div className="flex gap-2">
        <PendingButton className="text-xs bg-ember text-white rounded-lg px-3 py-1.5 disabled:opacity-50">Save testimony</PendingButton>
        <button type="button" onClick={() => setOpen(false)} className="text-xs border border-ink/15 rounded-lg px-3 py-1.5">Cancel</button>
      </div>
    </form>
  );
}
