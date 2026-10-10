"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ManualQuestionForm } from "./ManualQuestionForm";
import { generateQuestionsWithAI, saveGeneratedQuestions, GeneratedQuestion } from "../ai-actions";

/** Add quiz questions by hand, or (plans with AI writing help) generate them. */
export function NewQuestionsForm({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "ai">("manual");

  // AI generation state
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const result = await generateQuestionsWithAI(topic, count);
    setGenerating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setGenerated(result.questions);
  }

  function removeGenerated(index: number) {
    setGenerated((qs) => qs.filter((_, i) => i !== index));
  }

  async function handleSaveGenerated() {
    setSaving(true);
    const result = await saveGeneratedQuestions(generated);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/games/questions");
  }

  return (
    <div className="max-w-lg">
      <Link href="/dashboard/games/questions" className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink mb-2"><span aria-hidden>←</span> Quiz questions</Link>
      <h1 className="text-2xl font-semibold">Add questions</h1>
      <div className="rule-gold mt-2 mb-6" />

      {aiAvailable && (
      <div className="flex gap-2 mb-6" role="group" aria-label="How to add questions">
        <button
          type="button"
          aria-pressed={mode === "manual"}
          onClick={() => setMode("manual")}
          className={mode === "manual" ? "btn-primary" : "btn-secondary"}
        >
          Write manually
        </button>
        <button
          type="button"
          aria-pressed={mode === "ai"}
          onClick={() => setMode("ai")}
          className={mode === "ai" ? "btn-primary" : "btn-secondary"}
        >
          ✨ Generate with AI
        </button>
      </div>
      )}

      {mode === "manual" && (
        <ManualQuestionForm />
      )}

      {mode === "ai" && (
        <div>
          {!generated.length && (
            <div className="space-y-3">
              <label htmlFor="ai-topic" className="label">Topic <span className="font-normal text-ink/50">(optional)</span></label>
              <input
                id="ai-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic (optional), e.g. 'the Exodus' or 'Paul's journeys'"
                className="input"
              />
              <div className="flex items-center gap-2">
                <label htmlFor="ai-count" className="text-sm text-ink/60">How many?</label>
                <input
                  id="ai-count"
                  type="number"
                  min={1}
                  max={15}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 5)}
                  className="input w-20"
                />
              </div>
              {error && <p role="alert" className="text-danger text-sm">⚠ {error}</p>}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary"
              >
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          )}

          {generated.length > 0 && (
            <div>
              <p className="text-xs text-ink/40 mb-3">
                Review before saving — remove any that don't look right.
              </p>
              <div className="space-y-2 mb-4">
                {generated.map((q, i) => (
                  <div key={i} className="border border-ink/10 rounded-lg p-3 bg-surface text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">{q.question}</p>
                      <button onClick={() => removeGenerated(i)} className="text-xs text-danger shrink-0">
                        Remove
                      </button>
                    </div>
                    <ul className="text-xs text-ink/60 mt-1">
                      {q.choices.map((c, ci) => (
                        <li key={ci} className={ci === q.correctIndex ? "text-success" : ""}>
                          {ci === q.correctIndex ? "✓ " : "— "}
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveGenerated}
                  disabled={saving || !generated.length}
                  className="btn-primary"
                >
                  {saving ? "Saving..." : `Save ${generated.length} question(s)`}
                </button>
                <button
                  onClick={() => setGenerated([])}
                  className="border border-ink/20 px-6 py-3 rounded-lg font-medium"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
