"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { FieldError } from "@/components/ui/Alert";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { MAX_NOTE_LENGTH } from "@/lib/bible/annotations";

/**
 * Write or edit a private note on a verse (or a whole chapter). The dialog
 * stays open with the text intact until the save succeeds, so a failed save
 * (offline, expired session) never loses what someone wrote. Deleting asks
 * for confirmation first.
 */
export function NoteDialog({
  open,
  title,
  initialText,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  title: string;
  initialText: string;
  canDelete: boolean;
  /** Resolves to an error message, or null when saved. */
  onSave: (text: string) => Promise<string | null>;
  onDelete: () => Promise<boolean>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setText(initialText);
      setError(null);
      setConfirmingDelete(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialText]);

  const [confirm, confirmDialog] = useConfirm();

  async function close() {
    if (busy) return;
    if (
      text.trim() !== initialText.trim() &&
      text.trim() &&
      !(await confirm({ title: "Discard this note?", message: "What you've written will be lost.", confirmLabel: "Discard" }))
    )
      return;
    onClose();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const problem = await onSave(text);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  }

  async function remove() {
    setBusy(true);
    const ok = await onDelete();
    setBusy(false);
    if (ok) onClose();
    else setConfirmingDelete(false);
  }

  const remaining = MAX_NOTE_LENGTH - text.length;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return; // a nested confirm's Escape, handled there
        e.preventDefault();
        close();
      }}
      aria-labelledby="note-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] motion-safe:animate-modal-in"
    >
      <form onSubmit={save} className="p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="note-dialog-title" className="text-xl font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-sm text-ink/60">Only you can see your notes.</p>
          </div>
          <button type="button" onClick={close} className="btn-secondary btn-sm h-9 w-9 rounded-full p-0" aria-label="Close">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <label htmlFor="bible-note" className="label">
          Note
        </label>
        <textarea
          id="bible-note"
          className="input min-h-[9rem] resize-y"
          value={text}
          maxLength={MAX_NOTE_LENGTH}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby="bible-note-count bible-note-error"
          autoFocus
        />
        <p id="bible-note-count" className={`hint tabular ${remaining < 100 ? "text-warning" : ""}`}>
          {remaining.toLocaleString("en-ZA")} characters left
        </p>
        <FieldError id="bible-note-error">{error}</FieldError>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {canDelete ? (
            confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm delete">
                <span className="text-sm text-ink/70">Delete this note?</span>
                <button type="button" onClick={remove} disabled={busy} className="btn-danger btn-sm">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className="btn-secondary btn-sm">
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} className="btn-danger-outline btn-sm">
                Delete note
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={close} disabled={busy} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={busy || !text.trim()} className="btn-primary">
              {busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      </form>
      {confirmDialog}
    </dialog>
  );
}
