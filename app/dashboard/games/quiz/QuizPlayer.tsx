"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkAnswer, submitQuizAttempt, QuizQuestion } from "./actions";

export function QuizPlayer({ questions }: { questions: QuizQuestion[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [finished, setFinished] = useState(false);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  async function handleSelect(choiceIndex: number) {
    if (selected !== null || checking) return;
    setChecking(true);
    setSelected(choiceIndex);

    const result = await checkAnswer(current.id, choiceIndex);
    setCorrectIndex(result.correctIndex);
    if (result.correct) setScore((s) => s + 1);
    setChecking(false);
  }

  async function handleNext() {
    if (isLast) {
      const finalScore = score;
      await submitQuizAttempt(finalScore, questions.length);
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setCorrectIndex(null);
    }
  }

  if (!questions.length) {
    return <p className="text-ink/40 text-sm">No quiz questions available.</p>;
  }

  if (finished) {
    return (
      <div className="max-w-md text-center py-8">
        <p className="text-3xl font-semibold mb-2">
          {score} / {questions.length}
        </p>
        <p className="text-ink/50 mb-6">
          {score === questions.length
            ? "Perfect score! 🎉"
            : score >= questions.length * 0.7
            ? "Well done!"
            : "Good effort — try again to climb the scoreboard."}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => router.refresh()}
            className="bg-ember text-white px-5 py-2.5 rounded-lg text-sm font-medium"
          >
            Play again
          </button>
          <button
            onClick={() => router.push("/dashboard/games")}
            className="border border-ink/20 px-5 py-2.5 rounded-lg text-sm font-medium"
          >
            Back to scoreboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <p className="text-xs text-ink/40 mb-2">
        Question {index + 1} of {questions.length} · Score: {score}
      </p>
      <p className="text-lg font-medium mb-4">{current.question}</p>

      <div className="space-y-2 mb-6">
        {current.choices.map((choice, i) => {
          let style = "border-ink/20";
          if (selected !== null) {
            if (i === correctIndex) style = "border-success-line bg-success-tint";
            else if (i === selected) style = "border-danger-line bg-danger-tint";
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={selected !== null}
              className={`w-full text-left border rounded-lg px-4 py-3 text-sm ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          onClick={handleNext}
          className="bg-ember text-white px-5 py-2.5 rounded-lg text-sm font-medium"
        >
          {isLast ? "Finish quiz" : "Next question"}
        </button>
      )}
    </div>
  );
}
