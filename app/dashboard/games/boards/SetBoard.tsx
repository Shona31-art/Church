"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { SetView } from "../engine";
import type { BoardProps } from "../GameShell";
import { answerSetQuestion } from "../actions";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

/**
 * One question at a time, for emoji stories, "Who said it?" and fill in the
 * verse. Choice questions show four buttons; typed ones (Hard) a text box.
 * Each answer is locked in on the server, then the right answer is shown.
 */
export function SetBoard({ sessionId, view, finish, finishing, promptStyle }: BoardProps<SetView> & { promptStyle: "emoji" | "quote" | "verse" }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ correct: boolean; answer: string; reference?: string; picked?: number; answerIndex?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = view.questions[index];
  const last = index === view.questions.length - 1;

  async function submit(answer: number | string) {
    if (result || busy) return;
    setBusy(true);
    setError(null);
    const r = await callAction(() => answerSetQuestion(sessionId, index, answer), { error: CONNECTION_FAILED });
    setBusy(false);
    if (r.error || r.correct === undefined) return setError(r.error ?? "Couldn't check that answer.");
    setResult({ correct: r.correct, answer: r.answer ?? "", reference: r.reference, picked: typeof answer === "number" ? answer : undefined, answerIndex: r.answerIndex });
    if (r.correct) setScore((s) => s + 1);
  }

  function next() {
    if (last) return finish(null);
    setIndex((i) => i + 1);
    setResult(null);
    setTyped("");
  }

  if (!question) return <p className="text-sm text-ink/60">No questions available.</p>;

  const promptClass =
    promptStyle === "emoji"
      ? "text-5xl leading-snug tracking-wider sm:text-6xl"
      : promptStyle === "quote"
      ? "font-display text-2xl italic"
      : "font-display text-xl leading-relaxed";

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between text-xs text-ink/60">
        <span className="tabular">
          {index + 1} of {view.questions.length}
        </span>
        <span className="tabular">Score {score}</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${(index / view.questions.length) * 100}%` }} />
      </div>

      <p id="set-prompt" className={`mb-6 text-center ${promptClass}`} role={promptStyle === "emoji" ? "img" : undefined} aria-label={promptStyle === "emoji" ? `Emoji clue: ${question.prompt}` : undefined}>
        {question.prompt}
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      {question.choices ? (
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="set-prompt">
          {question.choices.map((choice, i) => {
            const isAnswer = result && result.answerIndex === i;
            const isWrongPick = result && result.picked === i && !result.correct;
            return (
              <button
                key={i}
                type="button"
                onClick={() => submit(i)}
                disabled={Boolean(result) || busy}
                className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  isAnswer ? "border-success-line bg-success-tint text-success" : isWrongPick ? "border-danger-line bg-danger-tint text-danger" : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span>{choice}</span>
                {isAnswer && <CheckCircle2 aria-label="Correct answer" className="h-4 w-4 shrink-0" />}
                {isWrongPick && <XCircle aria-label="Your answer" className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) submit(typed.trim());
          }}
        >
          <label htmlFor="set-answer" className="sr-only">
            Your answer
          </label>
          <input
            id="set-answer"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={Boolean(result) || busy}
            maxLength={200}
            autoComplete="off"
            placeholder={promptStyle === "verse" ? "Type the missing words, in order" : "Type the story"}
            className="input min-w-[12rem] flex-1"
          />
          {!result && (
            <button type="submit" className="btn-primary" disabled={busy || !typed.trim()}>
              Check
            </button>
          )}
        </form>
      )}

      <div role="status" className="mt-4 min-h-[1.5rem] text-sm">
        {result && (
          <p className={result.correct ? "font-medium text-success" : "text-ink/75"}>
            {result.correct ? "Correct! " : "Not quite — "}
            <span className="font-semibold">{result.answer}</span>
            {result.reference && <span className="text-ink/60"> · {result.reference}</span>}
          </p>
        )}
      </div>

      {result && (
        <button type="button" className="btn-primary mt-4" onClick={next} disabled={finishing} autoFocus>
          {last ? (finishing ? "Saving…" : "Finish") : "Next"}
        </button>
      )}
    </div>
  );
}
