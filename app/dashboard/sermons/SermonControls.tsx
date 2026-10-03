"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { addSermonNote, deleteSermon, deleteSermonNote } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";

export function SermonAdminActions({ id, title }: { id: string; title: string }) {
  const [state, action] = useFormState(deleteSermon, null);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <Link href={`/dashboard/sermons/${id}/edit`} className="btn-primary">
        Edit
      </Link>
      <form action={action}>
        <input type="hidden" name="sermon_id" value={id} />
        <ConfirmSubmitButton
          title={`Delete “${title}”?`}
          message="The sermon, its study notes and every member's private notes on it will be permanently deleted. This can't be undone."
          confirmLabel="Delete sermon"
          pendingLabel="Deleting…"
        >
          Delete
        </ConfirmSubmitButton>
      </form>
      {state?.error && <Alert tone="error" className="w-full">{state.error}</Alert>}
    </div>
  );
}

export function NoteForm({ sermonId }: { sermonId: string }) {
  const [state, action] = useFormState(addSermonNote, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="sermon_id" value={sermonId} />
      <label htmlFor="note" className="label">
        Add a note
      </label>
      <textarea id="note" name="note" rows={3} maxLength={5000} required placeholder="Jot down your own thoughts…" defaultValue={state?.values?.note} className="input" />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <PendingButton className="btn-secondary">Save note</PendingButton>
    </form>
  );
}

export function DeleteNoteButton({ noteId, sermonId }: { noteId: string; sermonId: string }) {
  const [state, action] = useFormState(deleteSermonNote, null);
  return (
    <form action={action}>
      <input type="hidden" name="note_id" value={noteId} />
      <input type="hidden" name="sermon_id" value={sermonId} />
      <ConfirmSubmitButton title="Delete this note?" message="Your private note will be permanently deleted." confirmLabel="Delete note" className="btn-ghost btn-sm" pendingLabel="Deleting…">
        Delete<span className="sr-only"> note</span>
      </ConfirmSubmitButton>
      {state?.error && <p className="text-xs text-danger mt-1">{state.error}</p>}
    </form>
  );
}
