type Tone = "error" | "warning" | "success" | "info";

const STYLES: Record<Tone, { box: string; icon: string; label: string }> = {
  error: { box: "bg-danger-tint border-danger-line text-danger", icon: "⚠", label: "Error" },
  warning: { box: "bg-warning-tint border-warning-line text-warning", icon: "!", label: "Warning" },
  success: { box: "bg-success-tint border-success-line text-success", icon: "✓", label: "Success" },
  info: { box: "bg-info-tint border-info-line text-info", icon: "i", label: "Note" },
};

/**
 * Inline message box. Errors are announced immediately (role="alert");
 * everything else politely (role="status"). The icon and a hidden label mean
 * the meaning never depends on colour alone.
 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const s = STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-lg border p-3 text-sm ${s.box} ${className}`}>
      <span aria-hidden className="font-bold leading-5 w-4 text-center shrink-0">
        {s.icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="sr-only">{s.label}: </span>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** One-line error under a field or button. */
export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-danger mt-1">
      <span aria-hidden>⚠ </span>
      {children}
    </p>
  );
}
