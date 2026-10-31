"use client";

import { haptic } from "@/lib/haptics";
import { useState } from "react";
import { CheckCircle2, Eye, RotateCcw } from "lucide-react";
import type { VersePuzzleView } from "../engine";
import type { BoardProps } from "../GameShell";
import { checkVerseAttempt, revealVerse } from "../actions";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

type Status = { kind: "playing" } | { kind: "wrong"; triesLeft: number } | { kind: "solved" } | { kind: "revealed"; text: string };

/** Tap words to build the verse in order; tap a placed word to send it back. Each verse is checked on the server. */
export function VersePuzzleBoard({ sessionId, view, finish, finishing }: BoardProps<VersePuzzleView>) {
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]); // positions in the scrambled list
  const [status, setStatus] = useState<Status>({ kind: "playing" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solvedCount, setSolvedCount] = useState(0);

  const verse = view.verses[index];
  const last = index === view.verses.length - 1;
  const locked = status.kind === "solved" || status.kind === "revealed";

  async function check() {
    setBusy(true);
    setError(null);
    const result = await callAction(() => checkVerseAttempt(sessionId, index, placed.map((i) => verse.words[i])), { error: CONNECTION_FAILED });
    setBusy(false);
    if (result.error) return setError(result.error);
    haptic(result.correct ? "success" : "error");
    if (result.correct) {
      setStatus({ kind: "solved" });
      setSolvedCount((n) => n + 1);
    } else setStatus({ kind: "wrong", triesLeft: result.triesLeft ?? 0 });
  }

  async function reveal() {
    setBusy(true);
    const result = await callAction(() => revealVerse(sessionId, index), { error: CONNECTION_FAILED });
    setBusy(false);
    if (result.error || !result.text) return setError(result.error ?? "Couldn't show the verse.");
    setStatus({ kind: "revealed", text: result.text });
  }

  function next() {
    if (last) return finish(null);
    setIndex((i) => i + 1);
    setPlaced([]);
    setStatus({ kind: "playing" });
    setError(null);
  }

  if (!verse) return <p className="text-sm text-ink/60">No verses available.</p>;

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-ink/60">
        <span className="tabular">
          Verse {index + 1} of {view.verses.length}
        </span>
        <span className="tabular">Solved {solvedCount}</span>
      </div>
      <p className="font-display text-xl font-semibold">{verse.reference}</p>

      {/* The verse being built */}
      <div className="mt-4 flex min-h-[4.5rem] flex-wrap gap-2 rounded-xl border border-dashed border-line-strong bg-parchment p-3" aria-label="Your verse" role="group">
        {placed.length === 0 && <span className="self-center text-sm text-ink/60">Tap the words below in order…</span>}
        {placed.map((i, n) => (
          <button
            key={i}
            type="button"
            disabled={locked || busy}
            onClick={() => setPlaced((p) => p.filter((x) => x !== i))}
            className="rounded-lg bg-ember px-3 py-1.5 text-sm text-on-ember"
            aria-label={`${verse.words[i]}, word ${n + 1}. Tap to remove.`}
          >
            {verse.words[i]}
          </button>
        ))}
      </div>

      {/* Remaining words */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Words to place">
        {verse.words.map((word, i) =>
          placed.includes(i) ? null : (
            <button key={i} type="button" disabled={locked || busy} onClick={() => setPlaced((p) => [...p, i])} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:border-line-strong">
              {word}
            </button>
          )
        )}
      </div>

      <div role="status" className="mt-4 min-h-[1.5rem] text-sm">
        {error && <span className="text-danger">{error}</span>}
        {status.kind === "solved" && (
          <span className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle2 aria-hidden className="h-4 w-4" /> Correct!
          </span>
        )}
        {status.kind === "wrong" && (
          <span className="text-warning">
            Not quite — {status.triesLeft > 0 ? `${status.triesLeft} ${status.triesLeft === 1 ? "try" : "tries"} left.` : "no tries left. Reveal it to carry on."}
          </span>
        )}
        {status.kind === "revealed" && <span className="text-ink/75">“{status.text}” (no point for this one)</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!locked ? (
          <>
            <button type="button" className="btn-primary" onClick={check} disabled={busy || placed.length !== verse.words.length || (status.kind === "wrong" && status.triesLeft === 0)}>
              Check
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPlaced([])} disabled={busy || placed.length === 0}>
              <RotateCcw aria-hidden className="h-4 w-4" /> Reset
            </button>
            <button type="button" className="btn-ghost" onClick={reveal} disabled={busy}>
              <Eye aria-hidden className="h-4 w-4" /> Reveal
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={next} disabled={finishing} autoFocus>
            {last ? (finishing ? "Saving…" : "Finish") : "Next verse"}
          </button>
        )}
      </div>
    </div>
  );
}
