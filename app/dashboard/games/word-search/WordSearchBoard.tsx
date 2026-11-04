"use client";

import { useRef, useState } from "react";
import { cellsBetween, lettersBetween, snapToLine, type WordSearchFind } from "@/lib/games/word-search";
import { haptic } from "@/lib/haptics";
import type { WordSearchView } from "../engine";
import type { BoardProps } from "../GameShell";

type Cell = [number, number];

/**
 * Drag from the first letter of a word to its last (the line snaps straight).
 * Tapping the first letter and then the last also works, and so does the
 * keyboard (Enter on each).
 */
export function WordSearchBoard({ view, finish, finishing }: BoardProps<WordSearchView>) {
  const [start, setStartState] = useState<Cell | null>(null);
  const [hover, setHoverState] = useState<Cell | null>(null);
  const dragging = useRef(false);
  // The same values, readable from the "finger lifted anywhere" listener below.
  const startRef = useRef<Cell | null>(null);
  const hoverRef = useRef<Cell | null>(null);
  const setStart = (c: Cell | null) => {
    startRef.current = c;
    setStartState(c);
  };
  const setHover = (c: Cell | null) => {
    hoverRef.current = c;
    setHoverState(c);
  };
  const [finds, setFinds] = useState<WordSearchFind[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const found = new Set(finds.map((f) => f.word));
  const foundCells = new Set<string>();
  for (const f of finds) {
    const dr = Math.sign(f.end[0] - f.start[0]);
    const dc = Math.sign(f.end[1] - f.start[1]);
    for (let i = 0; i < f.word.length; i++) foundCells.add(`${f.start[0] + dr * i}-${f.start[1] + dc * i}`);
  }
  const allFound = found.size === view.words.length;

  const preview = new Set(start && hover ? cellsBetween(start, hover).map(([r, c]) => `${r}-${c}`) : []);

  /** The square under a finger or mouse pointer. */
  function cellAt(x: number, y: number): Cell | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    if (!el) return null;
    const [r, c] = el.dataset.cell!.split("-").map(Number);
    return [r, c];
  }

  function onPointerDown(e: React.PointerEvent, cell: Cell) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    // Second tap of tap-tap: finish the word.
    if (start && !dragging.current && !(start[0] === cell[0] && start[1] === cell[1])) return complete(start, cell);
    setStart(cell);
    setHover(cell);
    setMessage(null);
    dragging.current = true;
    // So moves report the square under the finger, not this one. Never let it stop the drag.
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // No capture to release.
    }
    // Words along the edge: the finger often lifts just outside the grid, so
    // listen for the lift anywhere on the page, not only on the grid.
    const lifted = () => {
      window.removeEventListener("pointerup", lifted);
      window.removeEventListener("pointercancel", lifted);
      onPointerUp();
    };
    window.addEventListener("pointerup", lifted);
    window.addEventListener("pointercancel", lifted);
    haptic("select");
  }

  function onPointerMove(e: React.PointerEvent) {
    const from = startRef.current;
    if (!dragging.current || !from) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    const snapped = snapToLine(from, cell, view.size);
    const current = hoverRef.current;
    if (!current || snapped[0] !== current[0] || snapped[1] !== current[1]) setHover(snapped);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const from = startRef.current;
    const to = hoverRef.current;
    // A drag: check it. A tap (no movement): keep the first letter chosen for tap-tap.
    if (from && to && (to[0] !== from[0] || to[1] !== from[1])) complete(from, to);
    else setHover(null);
  }

  function complete(from: Cell, to: Cell) {
    setHover(null);
    setStart(null);
    check(from, to);
  }

  /** Keyboard: Enter on the first letter, then on the last. */
  function tap(cell: Cell) {
    if (!start) {
      setStart(cell);
      setMessage(null);
      return;
    }
    check(start, cell);
    setStart(null);
  }

  function check(start: Cell, cell: Cell) {
    const letters = lettersBetween(view.grid, start, cell);
    const reversed = letters ? [...letters].reverse().join("") : null;
    const word = view.words.find((w) => !found.has(w) && (w === letters || w === reversed));
    if (word) {
      const next = [...finds, { word, start, end: cell }];
      setFinds(next);
      setMessage(`Found ${word}!`);
      haptic("success");
      if (next.length === view.words.length) finish(next);
    } else {
      setMessage(letters && letters.length > 1 ? "Not one of the words — try again." : null);
      if (letters && letters.length > 1) haptic("error");
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-4 sm:p-6">
      <p className="mb-3 text-sm text-ink/60">
        Drag from the first letter of a word to its last. <span className="tabular font-medium text-ink">{found.size} / {view.words.length}</span> found.
      </p>
      <p role="status" className="mb-3 h-5 text-sm font-medium text-success">
        {message}
      </p>

      <div className="flex flex-wrap gap-6">
        <div
          className="grid w-full max-w-[min(100%,30rem)] touch-none select-none gap-0.5"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={(e) => e.pointerType === "mouse" && onPointerUp()}
          style={{ gridTemplateColumns: `repeat(${view.size}, minmax(0, 1fr))` }}
          role="grid"
          aria-label="Letter grid"
        >
          {view.grid.map((row, r) => (
            <div key={r} role="row" className="contents">
              {row.map((letter, c) => {
                const key = `${r}-${c}`;
                const isStart = start?.[0] === r && start?.[1] === c;
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-label={`${letter}, row ${r + 1}, column ${c + 1}${isStart ? ", selected" : ""}`}
                    data-cell={key}
                    onPointerDown={(e) => onPointerDown(e, [r, c])}
                    onClick={(e) => e.detail === 0 && tap([r, c])}
                    className={`aspect-square rounded-md text-[clamp(0.6rem,2.6vw,0.85rem)] font-semibold transition-colors ${
                      preview.has(key)
                        ? "bg-gold text-on-ember"
                        : foundCells.has(key)
                        ? "bg-ember text-on-ember"
                        : isStart
                        ? "bg-gold/40 text-ink"
                        : "border border-line bg-surface text-ink hover:bg-ink/5"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div>
          <p className="eyebrow mb-2">Find these words</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-1">
            {view.words.map((w) => (
              <li key={w} className={found.has(w) ? "text-ink/35 line-through" : "text-ink/85"}>
                {w}
                {found.has(w) && <span className="sr-only"> (found)</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!allFound && (
        <button type="button" className="btn-ghost btn-sm mt-6" onClick={() => finish(finds)} disabled={finishing}>
          {finishing ? "Saving…" : "Finish with what I've found"}
        </button>
      )}
    </div>
  );
}
