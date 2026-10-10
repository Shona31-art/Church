"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button for destructive or consequential server-action forms. Opens
 * an accessible confirmation dialog (native <dialog>: focus is trapped,
 * Escape cancels, focus returns to the button) that says exactly what will
 * happen, then submits the surrounding form. Disables itself while the
 * action runs, so it can't be double-submitted.
 *
 * Use a specific title ("Delete announcement?") and an explanation of the
 * consequence — never a generic "Are you sure?".
 */
export function ConfirmSubmitButton({
  title,
  message,
  confirmLabel,
  children,
  className = "btn-danger-outline",
  pendingLabel = "Working…",
  tone = "danger",
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  tone?: "danger" | "primary";
}) {
  const { pending } = useFormStatus();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  function confirm() {
    dialogRef.current?.close();
    triggerRef.current?.form?.requestSubmit();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={pending}
        aria-haspopup="dialog"
        className={className}
        onClick={() => dialogRef.current?.showModal()}
      >
        {pending ? pendingLabel : children}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] motion-safe:animate-modal-in"
      >
        <div className="p-6">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {title}
          </h2>
          <div id={`${id}-desc`} className="mt-2 text-sm text-ink/70">
            {message}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {/* Cancel gets focus first, so pressing Enter by reflex is safe. */}
            <button type="button" autoFocus className="btn-secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="button" className={tone === "danger" ? "btn-danger" : "btn-primary"} onClick={confirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Plain submit button that disables itself and shows progress while the action runs. */
export function PendingButton({
  children,
  className = "btn-primary",
  pendingLabel = "Saving…",
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
