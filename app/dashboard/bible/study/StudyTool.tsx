"use client";

import { useState } from "react";
import { runBibleStudy, StudyMode } from "./actions";
import { Alert } from "@/components/ui/Alert";

const MODE_OPTIONS: { value: StudyMode; label: string; hint: string }[] = [
  { value: "explain", label: "Explain", hint: "Context, meaning and application" },
  { value: "devotional", label: "Devotional", hint: "A short reflection and prayer" },
  { value: "cross_references", label: "Cross-references", hint: "Related passages" },
  { value: "reading_plan", label: "Reading plan", hint: "Seven days on this theme" },
];

export function StudyTool({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<StudyMode>("explain");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text?: string; passageText?: string; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      setResult(await runBibleStudy(query, mode));
    } catch {
      // Network drop or expired session mid-request.
      setResult({ error: "Couldn't reach the server — check your connection, or sign in again if your session expired." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card-elevated rounded-2xl p-5 space-y-4">
        <div>
          <label htmlFor="query" className="label">Passage or topic</label>
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Romans 8:28, Psalm 23, or 'forgiveness'"
            maxLength={200}
            required
            className="input"
          />
        </div>

        <fieldset>
          <legend className="label">What would you like?</legend>
          <div className="grid gap-2 grid-cols-2">
            {MODE_OPTIONS.map((m) => (
              <label
                key={m.value}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${
                  mode === m.value ? "border-ember bg-surface-raised" : "border-line-strong hover:bg-ink/5"
                }`}
              >
                <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="sr-only" />
                <span className="font-medium">{m.label}</span>
                <span className="block text-xs text-ink/60">{m.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Studying…" : "Study"}
        </button>
      </form>

      {loading && <div className="h-40 rounded-2xl bg-ink/[0.06] animate-pulse motion-reduce:animate-none" aria-busy="true" />}

      {result?.passageText && (
        <section className="card-elevated rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold">{query} · World English Bible</p>
          <p className="mt-2 leading-relaxed">{result.passageText}</p>
        </section>
      )}
      {result?.error && (
        <Alert tone="error">{result.error}</Alert>
      )}
      {result?.text && (
        <section className="card-elevated rounded-2xl p-5" aria-live="polite">
          <p className="text-xs text-ink/60 mb-3">AI-generated study notes — a starting point, not a replacement for your pastor or small group.</p>
          <div className="whitespace-pre-line leading-relaxed text-sm">{result.text}</div>
        </section>
      )}
    </div>
  );
}
