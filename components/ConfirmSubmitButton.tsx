"use client";

import { useFormStatus } from "react-dom";

// Submit button for destructive server-action forms: asks for confirmation
// first and disables itself while the action runs (no double submits).
export function ConfirmSubmitButton({
  message,
  children,
  className,
  pendingLabel = "Working…",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function PendingButton({
  children,
  className,
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
