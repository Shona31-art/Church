import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

type Tone = "error" | "warning" | "success" | "info";

const STYLES: Record<Tone, { box: string; Icon: LucideIcon; label: string }> = {
  error: { box: "bg-danger-tint border-danger-line text-danger", Icon: CircleAlert, label: "Error" },
  warning: { box: "bg-warning-tint border-warning-line text-warning", Icon: TriangleAlert, label: "Warning" },
  success: { box: "bg-success-tint border-success-line text-success", Icon: CircleCheck, label: "Success" },
  info: { box: "bg-info-tint border-info-line text-info", Icon: Info, label: "Note" },
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
  const { box, Icon, label } = STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${box} ${className}`}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <span className="sr-only">{label}: </span>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** One-line error under a field or button. */
export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-danger">
      <CircleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}
