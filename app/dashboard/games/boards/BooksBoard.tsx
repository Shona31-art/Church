"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { BoardProps } from "../GameShell";

interface BooksView {
  books: string[];
  section: string | null;
}

/** Tap the books in Bible order; tap a placed book to send it back. */
export function BooksBoard({ view, finish, finishing }: BoardProps<BooksView>) {
  const [placed, setPlaced] = useState<number[]>([]);
  const done = placed.length === view.books.length;

  return (
    <div className="card-elevated rounded-2xl p-6">
      <p className="text-sm text-ink/65">
        {view.section ? (
          <>
            Put the books of <span className="font-semibold text-ink">{view.section}</span> in order.
          </>
        ) : (
          "These books come one after another in the Bible. Put them in order."
        )}
      </p>

      <ol className="mt-4 min-h-[4rem] space-y-1.5 rounded-xl border border-dashed border-line-strong bg-parchment p-3" aria-label="Your order">
        {placed.length === 0 && <li className="text-sm text-ink/40">Tap the books below, first to last…</li>}
        {placed.map((i, n) => (
          <li key={i}>
            <button type="button" onClick={() => setPlaced((p) => p.filter((x) => x !== i))} className="flex w-full items-center gap-3 rounded-lg bg-ember px-3 py-2 text-left text-sm text-on-ember" aria-label={`${n + 1}. ${view.books[i]}. Tap to remove.`}>
              <span className="tabular w-5 opacity-70">{n + 1}</span>
              {view.books[i]}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Books to place">
        {view.books.map((book, i) =>
          placed.includes(i) ? null : (
            <button key={i} type="button" onClick={() => setPlaced((p) => [...p, i])} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-line-strong">
              {book}
            </button>
          )
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={!done || finishing} onClick={() => finish(placed.map((i) => view.books[i]))}>
          {finishing ? "Checking…" : "Check my order"}
        </button>
        <button type="button" className="btn-secondary" disabled={placed.length === 0} onClick={() => setPlaced([])}>
          <RotateCcw aria-hidden className="h-4 w-4" /> Reset
        </button>
      </div>
    </div>
  );
}
