"use client";

import { useState } from "react";
import type { ScrambleView } from "@/lib/games/word-games";
import type { BoardProps } from "../GameShell";

/** All the scrambled words on one page; type each answer, then check them together. */
export function ScrambleBoard({ view, finish, finishing }: BoardProps<ScrambleView>) {
  const [answers, setAnswers] = useState<string[]>(() => view.items.map(() => ""));
  const filled = answers.filter((a) => a.trim()).length;

  return (
    <form
      className="card-elevated space-y-4 rounded-2xl p-6"
      onSubmit={(e) => {
        e.preventDefault();
        finish(answers);
      }}
    >
      <ol className="space-y-4">
        {view.items.map((item, i) => (
          <li key={i} className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
              {[...item.letters].map((letter, j) => (
                <span key={j} className="flex h-9 w-8 items-center justify-center rounded-md border border-line-strong bg-parchment font-display text-lg font-semibold">
                  {letter}
                </span>
              ))}
            </div>
            <label htmlFor={`scramble-${i}`} className="mt-2 block text-sm text-ink/65">
              <span className="sr-only">Unscramble {item.letters.split("").join(" ")}. </span>
              {item.hint} <span className="text-ink/40">({item.length} letters)</span>
            </label>
            <input
              id={`scramble-${i}`}
              value={answers[i]}
              onChange={(e) => setAnswers((all) => all.map((a, k) => (k === i ? e.target.value : a)))}
              maxLength={item.length + 5}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="input mt-2 uppercase tracking-widest"
            />
          </li>
        ))}
      </ol>
      <button type="submit" className="btn-primary" disabled={finishing}>
        {finishing ? "Checking…" : filled < view.items.length ? `Check answers (${filled}/${view.items.length} filled)` : "Check answers"}
      </button>
    </form>
  );
}
