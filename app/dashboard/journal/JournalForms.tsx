"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { createJournalEntry, deleteJournalEntry } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions } from "@/components/ui/FormField";

export function NewEntryForm() {
  const [state, action] = useFormState(createJournalEntry, null);
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-4 max-w-2xl">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <label htmlFor="content" className="label">
        Today&apos;s entry
      </label>
      <textarea id="content" name="content" required rows={12} maxLength={20000} placeholder="Write whatever you need to…" defaultValue={state?.values?.content} className="input" />
      <FormActions>
        <PendingButton>Save entry</PendingButton>
        <Link href="/dashboard/journal" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

export function DeleteEntry({ id }: { id: string }) {
  const [state, action] = useFormState(deleteJournalEntry, null);
  return (
    <form action={action}>
      <input type="hidden" name="entry_id" value={id} />
      <ConfirmSubmitButton title="Delete this journal entry?" message="It will be permanently deleted. Nobody — including you — will be able to recover it." confirmLabel="Delete entry" className="btn-ghost btn-sm text-danger" pendingLabel="Deleting…">
        Delete
      </ConfirmSubmitButton>
      {state?.error && <p role="alert" className="text-xs text-danger mt-1">{state.error}</p>}
    </form>
  );
}
