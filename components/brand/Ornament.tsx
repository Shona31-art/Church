import { Mark } from "./BrandMark";

/**
 * Decorative obsidian-and-champagne artwork that holds the place of a hero
 * photo: a cathedral arch drawn in fine gold lines, with a verse set inside.
 * It's finished art, not a "missing image" box — when the church supplies
 * photography, swap it for next/image (README "Known gaps").
 */
export function Ornament({
  verse,
  reference,
  framed = true,
  className = "",
}: {
  verse: string;
  reference: string;
  /** false when it already sits on an obsidian panel (the sign-in screens). */
  framed?: boolean;
  className?: string;
}) {
  return (
    <figure className={`scope-dark ${framed ? "panel-luxe hairline-gold" : ""} relative isolate flex flex-col items-center justify-center overflow-hidden rounded-[28px] px-8 py-14 text-center ${className}`}>
      <svg aria-hidden viewBox="0 0 400 520" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 -z-10 h-full w-full text-gold">
        <g fill="none" stroke="currentColor">
          <path d="M60 510V210C60 120 125 50 200 50s140 70 140 160v300" strokeWidth="1" opacity="0.55" />
          <path d="M84 510V214C84 138 136 80 200 80s116 58 116 134v296" strokeWidth="0.6" opacity="0.35" />
          <path d="M108 510V220c0-62 40-110 92-110s92 48 92 110v290" strokeWidth="0.5" opacity="0.2" />
          <path d="M200 50v-30M188 32h24" strokeWidth="1" opacity="0.6" strokeLinecap="round" />
          <path d="M40 510h320" strokeWidth="0.8" opacity="0.4" />
        </g>
        <g fill="currentColor" opacity="0.5">
          <circle cx="60" cy="210" r="2" />
          <circle cx="340" cy="210" r="2" />
        </g>
      </svg>
      <Mark className="h-9 w-9 text-gold" />
      <blockquote className="mt-8 max-w-[18ch] font-display text-[30px] font-medium italic leading-[1.2] text-ink sm:text-[34px]">{verse}</blockquote>
      <div className="rule-gold mx-auto mt-6" />
      <figcaption className="mt-4 text-eyebrow font-semibold uppercase tracking-[0.24em] text-gold">{reference}</figcaption>
    </figure>
  );
}
