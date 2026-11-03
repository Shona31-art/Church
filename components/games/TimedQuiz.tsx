"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { haptic } from "@/lib/haptics";
import { showToast } from "@/components/ui/Toaster";
import { DUEL_SECONDS } from "@/lib/games/duel";

// The timed quiz used by Bible duels and church challenges: one question at a
// time, a 20-second clock, the answer checked on the server, the right answer
// shown briefly, then the next question.

export type AnswerResult = { correctIndex?: number; correct?: boolean; finished?: boolean; error?: string };

/** How long the right answer stays on screen before the next question. */
const REVEAL_MS = 1200;

/** The questions, one at a time, against the clock. Resumes where I left off. */
export function TimedQuiz({
  questions,
  startIndex,
  answer,
  onAnswered,
  footer,
}: {
  questions: { question: string; choices: string[] }[];
  /** Questions already answered (to carry on where I left off). */
  startIndex: number;
  /** Locks in one answer on the server (choice -1 = ran out of time). */
  answer: (index: number, choice: number) => Promise<AnswerResult>;
  onAnswered?: (done: number, finished: boolean, correct: boolean) => void;
  footer?: React.ReactNode;
}) {
  const total = questions.length;
  const [index, setIndex] = useState(startIndex);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [left, setLeft] = useState(DUEL_SECONDS);
  const [score, setScore] = useState(0);
  const lockRef = useRef(false);
  const question = questions[index];

  const choose = useCallback(
    async (choice: number) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setChecking(true);
      if (choice >= 0) setPicked(choice);
      const r = await callAction(() => answer(index, choice), { error: CONNECTION_FAILED } as AnswerResult);
      setChecking(false);
      if (r.error || r.correctIndex === undefined) {
        // Already answered (e.g. on another device): move on.
        if (/already answered|in order/.test(r.error ?? "")) {
          setIndex((i) => i + 1);
          lockRef.current = false;
          return;
        }
        lockRef.current = false;
        setPicked(null);
        return showToast(r.error ?? "Couldn't save your answer.", "error");
      }
      setCorrectIndex(r.correctIndex);
      haptic(r.correct ? "success" : "error");
      if (r.correct) setScore((s) => s + 1);
      onAnswered?.(index + 1, Boolean(r.finished), Boolean(r.correct));
      if (!r.finished) {
        setTimeout(() => {
          setIndex((i) => i + 1);
          setPicked(null);
          setCorrectIndex(null);
          lockRef.current = false;
        }, REVEAL_MS);
      }
    },
    [answer, index, onAnswered]
  );

  // The clock for this question; out of time counts as a wrong answer.
  useEffect(() => {
    setLeft(DUEL_SECONDS);
    const started = Date.now();
    const t = setInterval(() => {
      const remaining = DUEL_SECONDS - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(t);
        void choose(-1);
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only for a new question
  }, [index]);

  if (!question) return <div className="card-elevated rounded-2xl p-6">Saving your answers…</div>;
  const answered = correctIndex !== null;

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="mb-3 flex items-center justify-between text-xs text-ink/60">
        <span className="tabular">
          Question {index + 1} of {total} · ✓ {score}
        </span>
        <span className={`flex items-center gap-1 font-semibold tabular ${left <= 5 && !answered ? "text-danger motion-safe:animate-pulse" : ""}`} aria-live="off">
          <Clock aria-hidden className="h-3.5 w-3.5" /> {answered ? "—" : `${left}s`}
        </span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <div className={`h-full rounded-full transition-[width] duration-200 ${left <= 5 ? "bg-danger" : "bg-gold"}`} style={{ width: `${answered ? 0 : (left / DUEL_SECONDS) * 100}%` }} />
      </div>
      <p className="mb-5 font-display text-xl font-semibold" id="duel-question">
        {question.question}
      </p>
      <div className="space-y-2" role="group" aria-labelledby="duel-question">
        {question.choices.map((choice, i) => {
          const isAnswer = correctIndex === i;
          const wrongPick = picked === i && answered && correctIndex !== i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={picked !== null || checking || answered}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                isAnswer ? "border-success-line bg-success-tint text-success" : wrongPick ? "border-danger-line bg-danger-tint text-danger" : picked === i ? "border-gold bg-gold/10" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span>{choice}</span>
              {isAnswer && <CheckCircle2 aria-label="Correct answer" className="h-4 w-4 shrink-0" />}
              {wrongPick && <XCircle aria-label="Your answer" className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
      {answered && picked === null && <p className="mt-3 text-sm text-danger">Out of time!</p>}
      {footer && (
        <p className="mt-5 text-center text-xs text-ink/60" aria-live="polite">
          {footer}
        </p>
      )}
    </div>
  );
}

