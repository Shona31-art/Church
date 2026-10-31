"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { CROSSWORD_HINTS } from "@/lib/games/crossword-hints";
import { crosswordHint } from "../actions";
import { haptic } from "@/lib/haptics";
import type { CrosswordView } from "../engine";
import type { BoardProps } from "../GameShell";

type Dir = "across" | "down";
type Entry = CrosswordView["entries"][number];

/**
 * Type into the squares; the cursor moves along the current word.
 * Click a square twice (or press Space) to switch between Across and Down;
 * arrow keys move; Tab / Shift+Tab jump between clues; Backspace steps back.
 * Every square is a real input, so phone keyboards and screen readers work.
 */
export function CrosswordBoard({ sessionId, view, level, finish, finishing }: BoardProps<CrosswordView>) {
  const [letters, setLetters] = useState<string[][]>(() => Array.from({ length: view.height }, () => Array<string>(view.width).fill("")));
  const [active, setActive] = useState<{ r: number; c: number; dir: Dir }>(() => {
    const first = view.entries[0];
    return { r: first.row, c: first.col, dir: first.direction };
  });
  const [confirming, setConfirming] = useState(false);
  const [hintsLeft, setHintsLeft] = useState(CROSSWORD_HINTS[level] ?? 3);
  const [hinted, setHinted] = useState<Set<string>>(new Set());
  const [hinting, setHinting] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[][]>([]);

  const isOpen = (r: number, c: number) => view.shape[r]?.[c] === ".";

  // Which entries pass through each square, and the clue numbers that start there.
  const { entriesAt, numberAt } = useMemo(() => {
    const at = new Map<string, Entry[]>();
    const numbers = new Map<string, number>();
    for (const e of view.entries) {
      numbers.set(`${e.row},${e.col}`, e.number);
      for (let i = 0; i < e.length; i++) {
        const key = e.direction === "across" ? `${e.row},${e.col + i}` : `${e.row + i},${e.col}`;
        at.set(key, [...(at.get(key) ?? []), e]);
      }
    }
    return { entriesAt: at, numberAt: numbers };
  }, [view]);

  const entryFor = (r: number, c: number, dir: Dir) => {
    const here = entriesAt.get(`${r},${c}`) ?? [];
    return here.find((e) => e.direction === dir) ?? here[0];
  };
  const current = entryFor(active.r, active.c, active.dir);
  const cellsOf = (e: Entry) => Array.from({ length: e.length }, (_, i) => (e.direction === "across" ? [e.row, e.col + i] : [e.row + i, e.col]) as [number, number]);
  const inCurrent = (r: number, c: number) => Boolean(current && cellsOf(current).some(([er, ec]) => er === r && ec === c));
  const filled = (e: Entry) => cellsOf(e).every(([r, c]) => letters[r][c]);
  const allFilled = view.entries.every(filled);

  function focus(r: number, c: number, dir: Dir) {
    const e = entryFor(r, c, dir);
    setActive({ r, c, dir: e?.direction ?? dir });
    refs.current[r]?.[c]?.focus();
  }

  function move(dr: number, dc: number) {
    let r = active.r + dr;
    let c = active.c + dc;
    while (r >= 0 && c >= 0 && r < view.height && c < view.width) {
      if (isOpen(r, c)) return focus(r, c, dr !== 0 ? "down" : "across");
      r += dr;
      c += dc;
    }
  }

  /** Next square along the current word (stays put at the end). */
  function advance(r: number, c: number, dir: Dir, back = false) {
    const step = back ? -1 : 1;
    const nr = dir === "down" ? r + step : r;
    const nc = dir === "across" ? c + step : c;
    if (isOpen(nr, nc)) focus(nr, nc, dir);
  }

  function setLetter(r: number, c: number, value: string) {
    setLetters((prev) => prev.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? value : v)) : row)));
  }

  function jumpEntry(offset: number) {
    const index = view.entries.indexOf(current);
    const next = view.entries[(index + offset + view.entries.length) % view.entries.length];
    const [r, c] = cellsOf(next).find(([er, ec]) => !letters[er][ec]) ?? [next.row, next.col];
    focus(r, c, next.direction);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const keys: Record<string, () => void> = {
      ArrowRight: () => (active.dir === "across" ? move(0, 1) : focus(r, c, "across")),
      ArrowLeft: () => (active.dir === "across" ? move(0, -1) : focus(r, c, "across")),
      ArrowDown: () => (active.dir === "down" ? move(1, 0) : focus(r, c, "down")),
      ArrowUp: () => (active.dir === "down" ? move(-1, 0) : focus(r, c, "down")),
      " ": () => focus(r, c, active.dir === "across" ? "down" : "across"),
      Tab: () => jumpEntry(e.shiftKey ? -1 : 1),
      Backspace: () => {
        if (letters[r][c]) setLetter(r, c, "");
        else advance(r, c, active.dir, true);
      },
    };
    const handler = keys[e.key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  }

  // onChange (not keydown) so phone keyboards work: they often don't report keys.
  function onChange(e: React.ChangeEvent<HTMLInputElement>, r: number, c: number) {
    const letter = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
    if (!letter) return;
    setLetter(r, c, letter);
    advance(r, c, active.dir);
  }

  /** Fills one correct letter: the selected square if it's empty, else the first empty one in this word. */
  async function hint() {
    if (!current || hinting) return;
    const cells = cellsOf(current);
    // The selected square if it's empty; otherwise the first empty square in
    // this word; if the word is full, the selected square (to check a guess).
    const target: [number, number] =
      inCurrent(active.r, active.c) && !letters[active.r][active.c]
        ? [active.r, active.c]
        : cells.find(([r, c]) => !letters[r][c]) ?? [active.r, active.c];
    setHinting(true);
    setHintError(null);
    const result = await crosswordHint(sessionId, target[0], target[1]).catch(() => ({ error: "Couldn't get a hint — check your connection." }) as { error: string; letter?: string; hintsLeft?: number });
    setHinting(false);
    if (typeof result.hintsLeft === "number") setHintsLeft(result.hintsLeft);
    if (result.error || !result.letter) return setHintError(result.error ?? "Couldn't get a hint.");
    const [r, c] = target;
    setLetters((all) => all.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? result.letter! : v)) : row)));
    setHinted((set) => new Set(set).add(`${r},${c}`));
    haptic("select");
    const nextEmpty = cells.find(([er, ec]) => !(er === r && ec === c) && !letters[er][ec]);
    if (nextEmpty) focus(nextEmpty[0], nextEmpty[1], current.direction);
  }

  function submit() {
    if (!allFilled && !confirming) return setConfirming(true);
    finish(letters.map((row) => row.map((v) => v || " ").join("")));
  }

  // Squares fill the card's real width (not the screen's, which ignores the
  // card's padding and the gaps): up to 40px, down to 16px for the widest
  // grids on small phones, so the whole puzzle fits without scrolling.
  const gridBoxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = gridBoxRef.current;
    if (!el) return;
    const measure = () => setBoxWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const GAP = view.width > 12 ? 2 : 3;
  const cellPx = boxWidth ? Math.max(16, Math.min(40, Math.floor((boxWidth - GAP * (view.width - 1)) / view.width))) : 32;
  const cell = `${cellPx}px`;

  return (
    <div className="card-elevated rounded-2xl p-4 sm:p-6">
      {current && (
        <div className="sticky top-14 z-10 mb-4 rounded-xl border border-gold/40 bg-surface px-4 py-3 shadow-sm [background-image:linear-gradient(rgb(var(--gold)/0.12),rgb(var(--gold)/0.12))] md:top-2" aria-live="polite">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gold-deep">
            {current.direction === "across" ? <ArrowRight aria-hidden className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden className="h-3.5 w-3.5" />}
            {current.number} {current.direction === "across" ? "Across" : "Down"} · {current.length} letters
          </p>
          <div className="mt-0.5 flex items-start gap-3">
            <p className="min-w-0 flex-1 font-medium">{current.clue}</p>
            <button
              type="button"
              onClick={hint}
              disabled={hinting || hintsLeft <= 0 || finishing}
              className="btn-secondary btn-sm shrink-0"
              aria-label={`Hint: fill in one letter. ${hintsLeft} left`}
            >
              <Lightbulb aria-hidden className="h-4 w-4" /> {hinting ? "…" : `Hint (${hintsLeft})`}
            </button>
          </div>
          {hintError && <p className="mt-1 text-xs text-danger">{hintError}</p>}
        </div>
      )}

      <div ref={gridBoxRef} className="overflow-x-auto pb-2">
        <div
          className="mx-auto grid w-max"
          style={{ gridTemplateColumns: `repeat(${view.width}, ${cell})`, gap: `${GAP}px` }}
          role="grid"
          aria-label="Crossword grid"
        >
          {view.shape.map((row, r) => (
            <div key={r} role="row" className="contents">
              {[...row].map((square, c) => {
                if (square !== ".") return <div key={c} role="gridcell" aria-hidden style={{ width: cell, height: cell }} />;
                const number = numberAt.get(`${r},${c}`);
                const here = entriesAt.get(`${r},${c}`) ?? [];
                const isActive = active.r === r && active.c === c;
                const label = here.map((e) => `${e.number} ${e.direction}, letter ${(e.direction === "across" ? c - e.col : r - e.row) + 1} of ${e.length}`).join("; ");
                return (
                  <div key={c} role="gridcell" className="relative" style={{ width: cell, height: cell }}>
                    {number && <span aria-hidden className="pointer-events-none absolute left-0.5 top-0 text-[9px] font-semibold leading-none text-ink/60 sm:text-[10px]">{number}</span>}
                    <input
                      ref={(el) => {
                        (refs.current[r] ??= [])[c] = el;
                      }}
                      value={letters[r][c]}
                      onChange={(e) => onChange(e, r, c)}
                      onKeyDown={(e) => onKeyDown(e, r, c)}
                      onFocus={() => setActive((a) => (a.r === r && a.c === c ? a : { r, c, dir: entryFor(r, c, a.dir)?.direction ?? a.dir }))}
                      onClick={() => isActive && here.length > 1 && focus(r, c, active.dir === "across" ? "down" : "across")}
                      maxLength={2}
                      autoCapitalize="characters"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="text"
                      aria-label={`Row ${r + 1}, column ${c + 1}: ${label}`}
                      className={`h-full w-full rounded-[5px] border text-center font-semibold uppercase caret-transparent outline-none transition-colors focus-visible:outline-none ${
                        isActive ? "border-gold bg-gold/25" : inCurrent(r, c) ? "border-gold/50 bg-gold/10" : "border-line-strong bg-surface"
                      } ${hinted.has(`${r},${c}`) ? "text-gold-deep" : ""}`}
                      style={{ fontSize: `calc(${cell} * 0.5)` }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {(["across", "down"] as const).map((dir) => (
          <section key={dir} aria-labelledby={`clues-${dir}`}>
            <h2 id={`clues-${dir}`} className="eyebrow mb-2">
              {dir === "across" ? "Across" : "Down"}
            </h2>
            <ol className="space-y-1">
              {view.entries
                .filter((e) => e.direction === dir)
                .map((e) => {
                  const isCurrent = current === e;
                  const done = filled(e);
                  return (
                    <li key={`${dir}-${e.number}`}>
                      <button
                        type="button"
                        onClick={() => {
                          const [r, c] = cellsOf(e).find(([er, ec]) => !letters[er][ec]) ?? [e.row, e.col];
                          focus(r, c, e.direction);
                        }}
                        className={`flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${isCurrent ? "bg-gold/15" : "hover:bg-ink/5"} ${done && !isCurrent ? "text-ink/60" : ""}`}
                      >
                        <span className="tabular w-5 shrink-0 font-semibold">{e.number}</span>
                        <span className="flex-1">
                          {e.clue} <span className="text-ink/60">({e.length})</span>
                        </span>
                        {done && <CheckCircle2 aria-label="filled in" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/60" />}
                      </button>
                    </li>
                  );
                })}
            </ol>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={submit} disabled={finishing}>
          {finishing ? "Checking…" : confirming && !allFilled ? "Yes, check what I have" : "Check my answers"}
        </button>
        {confirming && !allFilled && (
          <>
            <span className="text-sm text-ink/60">Some squares are still empty.</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              Keep going
            </button>
          </>
        )}
      </div>
    </div>
  );
}
