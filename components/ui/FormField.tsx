import { FieldError } from "./Alert";

/**
 * Label + control + hint + error, wired together for screen readers. Pass the
 * control as children and give it the same `id` as `htmlFor`.
 */
export function FormField({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  children,
  className = "",
}: {
  label: React.ReactNode;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="font-normal text-ink/60"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="hint">
          {hint}
        </p>
      )}
      <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
    </div>
  );
}

/** Explains the red asterisk once per form. */
export function RequiredNote() {
  return (
    <p className="text-xs text-ink/60">
      Fields marked <span className="text-danger">*</span> are required.
    </p>
  );
}

/** Save / cancel row at the bottom of a form. */
export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap-reverse items-center justify-end gap-2 pt-2 sm:flex-wrap sm:justify-start">{children}</div>;
}
