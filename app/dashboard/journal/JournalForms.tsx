"use client";

import Link from "next/link";
import { QueuedNotice } from "@/components/OfflineQueue";
import { useOfflineSubmit } from "@/lib/use-offline-submit";
import { useFormState } from "react-dom";
import { createJournalEntry, deleteJournalEntry, updateJournalEntry } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions } from "@/components/ui/FormField";

export function NewEntryForm() {
  const [state, action] = useFormState(createJournalEntry, null);
  const onSubmit = useOfflineSubmit("journal");
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} onSubmit={onSubmit} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-4 max-w-2xl">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <QueuedNotice kind="journal" />
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

/** Edit an existing entry (text arrives decrypted from the server page). */
export function EditEntryForm({ id, content }: { id: string; content: string }) {
  const [state, action] = useFormState(updateJournalEntry, null);
  return (
    <form action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-4 max-w-2xl">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="entry_id" value={id} />
      <label htmlFor="content" className="label">
        Your entry
      </label>
      <textarea id="content" name="content" required rows={12} maxLength={20000} defaultValue={state?.values?.content ?? content} className="input" />
      <FormActions>
        <PendingButton>Save changes</PendingButton>
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
