"use client";

import { useState } from "react";
import { lettersBetween, type WordSearchFind } from "@/lib/games/word-search";
import type { WordSearchView } from "../engine";
import type { BoardProps } from "../GameShell";

type Cell = [number, number];

/** Tap the first letter of a word, then its last letter. Works with mouse, touch and keyboard. */
export function WordSearchBoard({ view, finish, finishing }: BoardProps<WordSearchView>) {
  const [start, setStart] = useState<Cell | null>(null);
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

  function tap(cell: Cell) {
    if (!start) {
      setStart(cell);
      setMessage(null);
      return;
    }
    const letters = lettersBetween(view.grid, start, cell);
    const reversed = letters ? [...letters].reverse().join("") : null;
    const word = view.words.find((w) => !found.has(w) && (w === letters || w === reversed));
    if (word) {
      const next = [...finds, { word, start, end: cell }];
      setFinds(next);
      setMessage(`Found ${word}!`);
      if (next.length === view.words.length) finish(next);
    } else {
      setMessage(letters && letters.length > 1 ? "Not one of the words — try again." : null);
    }
    setStart(null);
  }

  return (
    <div className="card-elevated rounded-2xl p-4 sm:p-6">
      <p className="mb-3 text-sm text-ink/60">
        Tap the first letter of a word, then its last letter. <span className="tabular font-medium text-ink">{found.size} / {view.words.length}</span> found.
      </p>
      <p role="status" className="mb-3 h-5 text-sm font-medium text-success">
        {message}
      </p>

      <div className="flex flex-wrap gap-6">
        <div
          className="grid w-full max-w-[min(100%,30rem)] select-none gap-0.5"
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
                    onClick={() => tap([r, c])}
                    className={`aspect-square rounded-md text-[clamp(0.6rem,2.6vw,0.85rem)] font-semibold ${
                      foundCells.has(key) ? "bg-ember text-on-ember" : isStart ? "bg-gold/40 text-ink" : "border border-line bg-surface text-ink hover:bg-ink/5"
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
