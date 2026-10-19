"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ManualQuestionForm } from "./ManualQuestionForm";
import { generateQuestionsWithAI, saveGeneratedQuestions, GeneratedQuestion } from "../ai-actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { Check, Sparkles, X } from "lucide-react";
import { FieldError } from "@/components/ui/Alert";

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
    const result = await callAction(() => generateQuestionsWithAI(topic, count), { error: CONNECTION_FAILED, questions: [] });
    setGenerating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setGenerated(result.questions);
  }

  const [confirm, confirmDialog] = useConfirm();

  async function discardGenerated() {
    const ok = await confirm({
      title: `Discard ${generated.length} generated question${generated.length === 1 ? "" : "s"}?`,
      message: "They haven't been saved, so you'd need to generate them again.",
      confirmLabel: "Discard",
    });
    if (ok) setGenerated([]);
  }

  function removeGenerated(index: number) {
    setGenerated((qs) => qs.filter((_, i) => i !== index));
  }

  async function handleSaveGenerated() {
    setSaving(true);
    setError(null);
    const result = await callAction(() => saveGeneratedQuestions(generated), { error: CONNECTION_FAILED });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/games/questions");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Add questions" back={{ href: "/dashboard/games/questions", label: "Quiz questions" }} />

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
          <Sparkles aria-hidden className="h-4 w-4" /> Generate with AI
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
              <label htmlFor="ai-topic" className="label">
                Topic <span className="font-normal text-ink/60">(optional)</span>
              </label>
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
              <FieldError>{error}</FieldError>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary"
              >
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          )}

          {generated.length > 0 && (
            <div>
              <p className="mb-3 text-xs text-ink/60">
                Review before saving — remove any that don't look right.
              </p>
              <div className="space-y-2 mb-4">
                {generated.map((q, i) => (
                  <div key={i} className="card-elevated rounded-2xl p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">{q.question}</p>
                      <button
                        type="button"
                        onClick={() => removeGenerated(i)}
                        disabled={saving}
                        aria-label={`Remove question ${i + 1}`}
                        className="btn-ghost btn-sm shrink-0 text-danger hover:text-danger"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                    <ul className="text-xs text-ink/60 mt-1">
                      {q.choices.map((c, ci) => (
                        <li key={ci} className={`flex items-center gap-1.5 ${ci === q.correctIndex ? "font-medium text-success" : ""}`}>
                          {ci === q.correctIndex ? (
                            <>
                              <Check aria-hidden className="h-3.5 w-3.5" />
                              <span className="sr-only">Correct answer: </span>
                            </>
                          ) : (
                            <span aria-hidden className="w-3.5 text-center">–</span>
                          )}
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <FieldError>{error}</FieldError>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveGenerated}
                  disabled={saving || !generated.length}
                  className="btn-primary"
                >
                  {saving ? "Saving…" : `Save ${generated.length} question${generated.length === 1 ? "" : "s"}`}
                </button>
                <button type="button" onClick={discardGenerated} disabled={saving} className="btn-secondary">
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
