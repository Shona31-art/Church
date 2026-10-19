import { BrandMark } from "./BrandMark";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

/**
 * Frame for the signed-out screens (sign in, register, password reset).
 * Desktop: a deep-navy brand panel on the left, the form on the right.
 * Phones and tablets: just the logo above the form, so the form is reachable
 * without scrolling past decoration.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden bg-panel text-on-panel lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-10 lg:p-12 xl:p-16">
        <BrandMark onPanel />
        <PhotoPlaceholder onPanel label="Awaiting church photo — 1200×900" className="flex-1" />
        <figure>
          <blockquote className="max-w-md font-display text-[26px] leading-snug">“Let all that you do be done in love.”</blockquote>
          <div className="rule-gold mt-4" />
          <figcaption className="mt-3 text-sm text-on-panel/65">1 Corinthians 16:14 (WEB)</figcaption>
        </figure>
      </aside>

      <div className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
        <BrandMark className="self-start lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-10 motion-safe:animate-fade-in">{children}</div>
      </div>
    </main>
  );
}

/** Title block at the top of an auth form: small eyebrow, heading, gold rule, optional line. */
export function AuthHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
      <div className="rule-gold mt-3" />
      {children && <p className="mt-3 text-sm text-ink/60">{children}</p>}
    </div>
  );
}
