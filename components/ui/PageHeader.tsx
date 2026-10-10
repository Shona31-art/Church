import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * Top of every dashboard page: optional back link, title, one-line
 * description, and the page's actions on the right. Put the primary action
 * last so it sits at the far right on desktop.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Small status line under the title, e.g. a badge. */
  meta?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link href={back.href} data-page-back className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink/55 hover:text-ink">
          <ChevronLeft aria-hidden className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight break-words sm:text-[32px]">{title}</h1>
          <div className="rule-gold mt-3" />
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
          {description && <p className="mt-3 max-w-2xl text-[15px] text-ink/60">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A titled card inside a page (detail pages, settings). */
export function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`card-elevated rounded-2xl p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 id={id} className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-sm text-ink/60 mt-1">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Label/value rows for detail pages. */
export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr] text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="font-medium text-ink/50">{item.label}</dt>
          <dd className="break-words">{item.value ?? <span className="text-ink/40">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
