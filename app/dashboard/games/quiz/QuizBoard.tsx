"use client";

import { haptic } from "@/lib/haptics";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { QuizView } from "../engine";
import type { BoardProps } from "../GameShell";
import { revealQuizAnswer } from "../actions";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

/** One question at a time. Your first pick is locked in on the server, then the answer is shown. */
export function QuizBoard({ sessionId, view, finish, finishing }: BoardProps<QuizView>) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [checking, setChecking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const question = view.questions[index];
  const last = index === view.questions.length - 1;

  async function choose(choice: number) {
    if (picked !== null || checking !== null) return;
    // Show the tap straight away while the server checks it.
    setChecking(choice);
    setError(null);
    const result = await callAction(() => revealQuizAnswer(sessionId, index, choice), { error: CONNECTION_FAILED });
    setChecking(null);
    if (result.error || result.correctIndex === undefined) return setError(result.error ?? "Couldn't check that answer.");
    setPicked(result.chosen ?? choice);
    setCorrectIndex(result.correctIndex);
    const right = (result.chosen ?? choice) === result.correctIndex;
    haptic(right ? "success" : "error");
    if (right) setScore((s) => s + 1);
  }

  function next() {
    if (last) return finish(null);
    setIndex((i) => i + 1);
    setPicked(null);
    setCorrectIndex(null);
  }

  if (!question) return <p className="text-sm text-ink/60">No questions available.</p>;

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-ink/60">
        <span className="tabular">
          Question {index + 1} of {view.questions.length}
        </span>
        <span className="tabular">Score {score}</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${(index / view.questions.length) * 100}%` }} />
      </div>

      <p className="mb-5 font-display text-xl font-semibold" id="quiz-question">
        {question.question}
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-2" role="group" aria-labelledby="quiz-question">
        {question.choices.map((choice, i) => {
          const isAnswer = correctIndex === i;
          const isWrongPick = picked === i && correctIndex !== null && correctIndex !== i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={picked !== null || checking !== null}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                isAnswer ? "border-success-line bg-success-tint text-success" : isWrongPick ? "border-danger-line bg-danger-tint text-danger" : checking === i ? "border-gold bg-gold/10" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span>{choice}</span>
              {checking === i && <span className="text-xs text-ink/60 motion-safe:animate-pulse">Checking…</span>}
              {isAnswer && (
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <CheckCircle2 aria-hidden className="h-4 w-4" /> Correct answer
                </span>
              )}
              {isWrongPick && (
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <XCircle aria-hidden className="h-4 w-4" /> Your answer
                </span>
              )}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <button type="button" className="btn-primary mt-6" onClick={next} disabled={finishing} autoFocus>
          {last ? (finishing ? "Saving…" : "Finish") : "Next question"}
        </button>
      )}
    </div>
  );
}
