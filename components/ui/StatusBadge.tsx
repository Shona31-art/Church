export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-raised text-ink/70 border-line",
  success: "bg-success-tint text-success border-success-line",
  warning: "bg-warning-tint text-warning border-warning-line",
  danger: "bg-danger-tint text-danger border-danger-line",
  info: "bg-info-tint text-info border-info-line",
};

/** Small pill for a record's state. The label is always words, never colour alone. */
export function StatusBadge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
