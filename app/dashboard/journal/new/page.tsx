"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createJournalEntry } from "./actions";

export default function NewJournalEntryPage() {
  const [state, formAction] = useFormState(createJournalEntry, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold mb-2">New journal entry</h1>
      <p className="text-xs text-ink/40 mb-4">
        This is just between you and God. No one else can read this.
      </p>

      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <textarea
        name="content"
        placeholder="Write whatever you need to..."
        required
        rows={10}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
    >
      {pending ? "Saving..." : "Save entry"}
    </button>
  );
}
