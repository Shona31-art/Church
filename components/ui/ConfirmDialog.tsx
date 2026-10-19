"use client";

import { useCallback, useId, useRef, useState } from "react";

type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

/**
 * Styled replacement for window.confirm in client components that need to
 * ask before doing something in code (not on a form submit — use
 * ConfirmSubmitButton for that).
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: "Discard changes?", ... }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 *
 * Native <dialog>, like ConfirmSubmitButton: focus is trapped, Escape
 * cancels, focus returns to whatever opened it, and it stacks correctly on
 * top of another open dialog (both live in the browser's top layer).
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const id = useId();

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second request while one is open answers the first with "no".
    resolveRef.current?.(false);
    setOptions(next);
    // Open after React has rendered the new text into the dialog.
    requestAnimationFrame(() => dialogRef.current?.showModal());
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function finish(ok: boolean) {
    dialogRef.current?.close();
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] motion-safe:animate-modal-in"
    >
      {options && (
        <div className="p-6">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {options.title}
          </h2>
          <div id={`${id}-desc`} className="mt-2 text-sm text-ink/70">
            {options.message}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {/* Cancel gets focus first, so pressing Enter by reflex is safe. */}
            <button type="button" autoFocus className="btn-secondary" onClick={() => finish(false)}>
              {options.cancelLabel ?? "Keep editing"}
            </button>
            <button type="button" className={options.tone === "primary" ? "btn-primary" : "btn-danger"} onClick={() => finish(true)}>
              {options.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );

  return [confirm, dialog];
}
