import { ImageIcon } from "lucide-react";

/**
 * Labelled stand-in for a photo the church hasn't supplied yet, so it's
 * obvious what still needs a real asset — never a generic stock photo.
 * Replace each use with next/image once the file is in /public.
 */
export function PhotoPlaceholder({ label, onPanel = false, className = "" }: { label: string; onPanel?: boolean; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Placeholder: ${label}`}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center ${
        onPanel ? "border-on-panel/25 bg-on-panel/[0.04] text-on-panel/60" : "border-line-strong bg-surface-raised text-ink/60"
      } ${className}`}
    >
      <ImageIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
