import Link from "next/link";
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";
import { Cross } from "./Cross";

/**
 * The app logo: the Grace cross and the "Grace" script wordmark, with
 * "by Grace-bound Ventures" beneath when `byline` is set. This is the only
 * place the logo is drawn in the app, so every screen updates together.
 * Files for print and social: public/brand/ (scripts/build-brand.mjs).
 */
export function BrandMark({
  href = "/",
  onPanel = false,
  byline = false,
  className = "",
}: {
  href?: string;
  onPanel?: boolean;
  byline?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} aria-label={`${APP_NAME} — home`} className={`inline-flex items-center gap-2 rounded-lg ${className}`}>
      <Cross className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <Wordmark className="text-[2rem]" />
        {byline && (
          <span className={`-mt-0.5 whitespace-nowrap text-[0.5rem] font-semibold uppercase tracking-[0.16em] min-[400px]:text-[0.5625rem] min-[400px]:tracking-[0.22em] ${onPanel ? "text-teal-soft" : "text-teal"}`}>
            by {COMPANY_NAME}
          </span>
        )}
      </span>
    </Link>
  );
}

/** "Grace" in the brand script: teal into a rose highlight (pale on dark backgrounds — the --wm-* tokens). */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`bg-[linear-gradient(90deg,rgb(var(--wm-1)),rgb(var(--wm-2))_55%,rgb(var(--wm-3)))] bg-clip-text pb-1 pr-1 font-script leading-none text-transparent ${className}`}>
      {APP_NAME}
    </span>
  );
}
