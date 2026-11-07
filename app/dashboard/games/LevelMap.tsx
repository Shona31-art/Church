"use client";

import { useEffect, useRef } from "react";
import { Lock, Star } from "lucide-react";
import { KIDS_STAGE_COUNT, STAGE_COUNT, highestUnlocked } from "@/lib/games/stages";

const BANDS = [
  { label: "Easy", from: 1, to: 30 },
  { label: "Medium", from: 31, to: 65 },
  { label: "Hard", from: 66, to: STAGE_COUNT },
] as const;

const KIDS_BANDS = [{ label: "Kids", from: 1, to: KIDS_STAGE_COUNT }] as const;

/** Levels 1–100 (Kids mode: 1–30): passed levels show their stars, the next one glows, the rest are locked. */
export function LevelMap({ stars, onPick, busy, kids = false }: { stars: Record<number, number>; onPick: (stage: number) => void; busy: boolean; kids?: boolean }) {
  const count = kids ? KIDS_STAGE_COUNT : STAGE_COUNT;
  const bands = kids ? KIDS_BANDS : BANDS;
  const next = highestUnlocked(stars, count);
  const total = Object.values(stars).reduce((sum, s) => sum + s, 0);
  const passed = Object.values(stars).filter((s) => s > 0).length;
  const currentRef = useRef<HTMLButtonElement>(null);

  // Bring the level you're up to into view.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  return (
    <section aria-labelledby="levels-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="levels-heading" className="text-lg font-semibold">
          Levels
        </h2>
        <p className="tabular text-sm text-ink/60">
          {passed} of {count} passed · <Star aria-hidden className="inline h-3.5 w-3.5 -translate-y-px fill-gold text-gold" /> {total}
        </p>
      </div>
      <div className="max-h-[22rem] space-y-4 overflow-y-auto rounded-xl border border-line p-3">
        {bands.map((band) => (
          <div key={band.label}>
            <p className="eyebrow mb-2">
              {band.label} · {band.from}–{band.to}
            </p>
            <ul className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: band.to - band.from + 1 }, (_, i) => band.from + i).map((stage) => {
                const s = stars[stage] ?? 0;
                const locked = stage > next;
                const isNext = stage === next;
                return (
                  <li key={stage}>
                    <button
                      ref={isNext ? currentRef : undefined}
                      type="button"
                      disabled={locked || busy}
                      onClick={() => onPick(stage)}
                      aria-label={locked ? `Level ${stage}, locked` : `Level ${stage}${s ? `, ${s} ${s === 1 ? "star" : "stars"}` : isNext ? ", next to play" : ""}`}
                      className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                        locked
                          ? "border-line bg-ink/[0.03] text-ink/30"
                          : isNext
                          ? "border-gold bg-gold/15 text-ink shadow-[0_0_0_3px_rgb(var(--gold)/0.25)] motion-safe:animate-pulse"
                          : s
                          ? "border-gold/50 bg-surface text-ink hover:bg-gold/10"
                          : "border-line bg-surface text-ink hover:border-line-strong"
                      }`}
                    >
                      {locked ? <Lock aria-hidden className="h-3.5 w-3.5" /> : <span className="tabular leading-none">{stage}</span>}
                      {!locked && s > 0 && (
                        <span aria-hidden className="mt-0.5 flex">
                          {[1, 2, 3].map((n) => (
                            <Star key={n} className={`h-2.5 w-2.5 ${n <= s ? "fill-gold text-gold" : "text-ink/20"}`} />
                          ))}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink/60">Get 70% to pass a level and unlock the next. 90% earns two stars, a perfect game three.</p>
    </section>
  );
}
