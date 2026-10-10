"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pickRound, scrambleOrder, tokenize, isCorrectOrder, PuzzleVerse } from "@/lib/verse-puzzle";
import { submitQuizAttempt } from "../quiz/actions";

const ROUND_SIZE = 5;

interface Tile {
  id: number; // position in the scrambled pool (stable key even for repeated words)
  word: string;
}

export function VersePuzzlePlayer() {
  // Chosen after mount, not during render: random picks would differ between
  // the server render and the browser and cause a hydration mismatch.
  const [round, setRound] = useState<PuzzleVerse[]>([]);
  useEffect(() => setRound(pickRound(ROUND_SIZE)), []);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [status, setStatus] = useState<"playing" | "correct" | "wrong" | "revealed">("playing");
  const [finished, setFinished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const verse = round[index];
  const words = useMemo(() => (verse ? tokenize(verse.text) : []), [verse]);
  const pool: Tile[] = useMemo(
    () => scrambleOrder(words.length).map((wordIndex, id) => ({ id, word: words[wordIndex] })),
    [words]
  );
  const available = pool.filter((t) => !placed.some((p) => p.id === t.id));

  function place(tile: Tile) {
    if (status !== "playing") return;
    setPlaced((p) => [...p, tile]);
  }

  function unplace(tile: Tile) {
    if (status !== "playing") return;
    setPlaced((p) => p.filter((t) => t.id !== tile.id));
  }

  function check() {
    const correct = isCorrectOrder(words, placed.map((t) => t.word));
    setStatus(correct ? "correct" : "wrong");
    if (correct) setScore((s) => s + 1);
  }

  async function next() {
    if (index + 1 >= round.length) {
      setFinished(true);
      const result = await submitQuizAttempt(score, round.length, "verse_puzzle");
      if (result.error) setSaveError(result.error);
      return;
    }
    setIndex((i) => i + 1);
    setPlaced([]);
    setStatus("playing");
  }

  function playAgain() {
    setRound(pickRound(ROUND_SIZE));
    setIndex(0);
    setScore(0);
    setPlaced([]);
    setStatus("playing");
    setFinished(false);
    setSaveError(null);
  }

  if (!verse) return <div className="h-48 rounded-2xl bg-ink/[0.06] animate-pulse motion-reduce:animate-none" aria-busy="true" />;

  if (finished) {
    return (
      <div className="card-elevated rounded-2xl p-6 text-center">
        <p className="text-sm text-ink/50">Round complete</p>
        <p className="text-4xl font-semibold mt-2">{score} / {round.length}</p>
        {saveError ? (
          <p className="text-sm text-danger mt-3" role="alert">⚠ {saveError}</p>
        ) : (
          <p className="text-xs text-ink/40 mt-2">Your score was added to the church scoreboard.</p>
        )}
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={playAgain} className="btn-primary">
            Play again
          </button>
          <Link href="/dashboard/games" className="border border-ink/15 px-5 py-2.5 rounded-lg text-sm">
            Back to scoreboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex items-center justify-between text-xs text-ink/50">
        <span>Verse {index + 1} of {round.length}</span>
        <span>Score: {score}</span>
      </div>
      <p className="mt-3 font-semibold">{verse.reference} <span className="text-ink/40 font-normal text-sm">(WEB)</span></p>

      {/* The answer being built. Tap a word to send it back. */}
      <div
        className="mt-4 min-h-[64px] rounded-xl border-2 border-dashed border-ink/15 p-3 flex flex-wrap gap-2"
        aria-label="Your answer"
        aria-live="polite"
      >
        {placed.length === 0 && <span className="text-sm text-ink/40">Tap the words below in order…</span>}
        {placed.map((t) => (
          <button
            key={t.id}
            onClick={() => unplace(t)}
            disabled={status !== "playing"}
            className="btn-primary btn-sm"
            aria-label={`Remove ${t.word}`}
          >
            {t.word}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Available words">
        {available.map((t) => (
          <button
            key={t.id}
            onClick={() => place(t)}
            disabled={status !== "playing"}
            className="px-3 py-1.5 rounded-lg border border-ink/20 text-sm hover:bg-ink/5"
          >
            {t.word}
          </button>
        ))}
      </div>

      {status === "correct" && <p className="mt-4 text-sm text-success" role="status">✓ Correct — well done!</p>}
      {status === "wrong" && (
        <p className="mt-4 text-sm text-danger" role="status">
          ✗ Not quite. Reset and try again, or reveal the answer.
        </p>
      )}
      {status === "revealed" && (
        <p className="mt-4 text-sm text-ink/70" role="status">Answer: “{verse.text}”</p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {status === "playing" && (
          <>
            <button
              onClick={check}
              disabled={placed.length !== words.length}
              className="btn-primary"
            >
              Check
            </button>
            <button onClick={() => setPlaced([])} className="border border-ink/15 px-4 py-2.5 rounded-lg text-sm">
              Reset
            </button>
          </>
        )}
        {status === "wrong" && (
          <>
            <button onClick={() => { setPlaced([]); setStatus("playing"); }} className="border border-ink/15 px-4 py-2.5 rounded-lg text-sm">
              Try again
            </button>
            <button onClick={() => setStatus("revealed")} className="border border-ink/15 px-4 py-2.5 rounded-lg text-sm">
              Reveal answer
            </button>
          </>
        )}
        {(status === "correct" || status === "revealed") && (
          <button onClick={next} className="btn-primary">
            {index + 1 >= round.length ? "Finish" : "Next verse"}
          </button>
        )}
      </div>
    </div>
  );
}
