import Link from "next/link";

/**
 * Product logo: mark + "Grace-bound" wordmark.
 *
 * BRAND PLACEHOLDER: the gold square stands in for the real logo, which
 * hasn't been supplied yet. When it arrives (SVG preferred), put it in
 * /public and swap the <span> mark below for it — this is the only place the
 * product logo is drawn, so every screen updates at once.
 */
export function BrandMark({ href = "/", onPanel = false, className = "" }: { href?: string; onPanel?: boolean; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 rounded-lg ${onPanel ? "text-on-panel" : "text-ink"} ${className}`}>
      <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-[4px] bg-gold" />
      <span className="font-display text-lg font-semibold tracking-[-0.01em]">Grace-bound</span>
    </Link>
  );
}
