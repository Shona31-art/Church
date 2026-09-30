"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuestion } from "./actions";
import { generateQuestionsWithAI, saveGeneratedQuestions, GeneratedQuestion } from "../ai-actions";

export default function NewQuestionPage() {
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
      <h1 className="text-2xl font-semibold mb-4">Add questions</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("manual")}
          className={`text-sm px-4 py-2 rounded-lg ${mode === "manual" ? "bg-ember text-white" : "border border-ink/20"}`}
        >
          Write manually
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`text-sm px-4 py-2 rounded-lg ${mode === "ai" ? "bg-ember text-white" : "border border-ink/20"}`}
        >
          ✨ Generate with AI
        </button>
      </div>

      {mode === "manual" && (
        <form action={createQuestion} className="space-y-3">
          <textarea
            name="question"
            placeholder="Question"
            required
            rows={2}
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct_index" value={i} defaultChecked={i === 0} />
              <input
                name={`choice_${i}`}
                placeholder={`Choice ${i + 1}${i === 0 ? " (mark the radio button for the correct one)" : ""}`}
                required
                className="flex-1 border border-ink/20 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <select name="category" className="flex-1 border border-ink/20 rounded-lg px-3 py-2 text-sm">
              <option value="old_testament">Old Testament</option>
              <option value="new_testament">New Testament</option>
              <option value="people">People</option>
              <option value="numbers">Numbers</option>
              <option value="general">General</option>
            </select>
            <select name="difficulty" defaultValue="medium" className="flex-1 border border-ink/20 rounded-lg px-3 py-2 text-sm">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
            Save question
          </button>
        </form>
      )}

      {mode === "ai" && (
        <div>
          {!generated.length && (
            <div className="space-y-3">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Topic (optional), e.g. 'the Exodus' or 'Paul's journeys'"
                className="w-full border border-ink/20 rounded-lg px-4 py-3 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-ink/50">How many?</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 5)}
                  className="w-20 border border-ink/20 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
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
                  <div key={i} className="border border-ink/10 rounded-lg p-3 bg-white/60 text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">{q.question}</p>
                      <button onClick={() => removeGenerated(i)} className="text-xs text-red-700 shrink-0">
                        Remove
                      </button>
                    </div>
                    <ul className="text-xs text-ink/60 mt-1">
                      {q.choices.map((c, ci) => (
                        <li key={ci} className={ci === q.correctIndex ? "text-green-700" : ""}>
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
                  className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
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
