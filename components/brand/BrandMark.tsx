import Link from "next/link";

/**
 * Product logo: mark + "Grace-bound" wordmark.
 *
 * BRAND PLACEHOLDER: the gold diamond-and-cross stands in for the real logo,
 * which hasn't been supplied yet. When it arrives (SVG preferred), put it in
 * /public and swap <Mark /> below for it — this is the only place the product
 * logo is drawn, so every screen updates at once.
 */
export function BrandMark({ href = "/", onPanel = false, className = "" }: { href?: string; onPanel?: boolean; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-3 rounded-lg ${onPanel ? "text-on-panel" : "text-ink"} ${className}`}>
      <Mark className="h-6 w-6 text-gold" />
      <span className="font-display text-[19px] font-semibold uppercase leading-none tracking-[0.2em]">Grace-bound</span>
    </Link>
  );
}

/** The stand-in mark: a champagne diamond framing a slender cross. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 1.5 22.5 12 12 22.5 1.5 12Z" stroke="currentColor" strokeWidth="1.1" />
      <path d="M12 5.5 18.5 12 12 18.5 5.5 12Z" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
      <path d="M12 7.5v9M9.25 10.5h5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
