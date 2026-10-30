import { BrandMark } from "./BrandMark";
import { Ornament } from "./Ornament";

/**
 * Frame for the signed-out screens (sign in, register, password reset).
 * Desktop: an obsidian brand panel on the left, the form on the right.
 * Phones and tablets: just the logo above the form, so the form is reachable
 * without scrolling past decoration.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="scope-dark panel-luxe hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-10 lg:p-12 xl:p-16">
        <BrandMark />
        <Ornament verse="Let all that you do be done in love." reference="1 Corinthians 16:14" framed={false} className="flex-1" />
        <p className="text-eyebrow uppercase tracking-[0.24em] text-ink/50">Private · Secure · For your whole church</p>
      </aside>

      <div className="flex min-h-screen min-h-dvh flex-col px-4 py-6 sm:px-8">
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
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h1 className="text-title-lg font-medium leading-tight">{title}</h1>
      <div className="rule-gold mt-4" />
      {children && <p className="mt-4 text-sm text-ink/60">{children}</p>}
    </div>
  );
}
