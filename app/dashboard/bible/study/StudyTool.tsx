"use client";

import { useState } from "react";
import { runBibleStudy, StudyMode } from "./actions";

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
          <label htmlFor="query" className="block text-sm font-medium mb-1">Passage or topic</label>
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Romans 8:28, Psalm 23, or 'forgiveness'"
            maxLength={200}
            required
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          />
        </div>

        <fieldset>
          <legend className="block text-sm font-medium mb-2">What would you like?</legend>
          <div className="grid gap-2 grid-cols-2">
            {MODE_OPTIONS.map((m) => (
              <label
                key={m.value}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${mode === m.value ? "border-ember bg-ink/[0.03]" : "border-ink/15 hover:bg-ink/5"}`}
              >
                <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="sr-only" />
                <span className="font-medium">{m.label}</span>
                <span className="block text-xs text-ink/50">{m.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={loading} className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50">
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
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">⚠ {result.error}</p>
      )}
      {result?.text && (
        <section className="card-elevated rounded-2xl p-5" aria-live="polite">
          <p className="text-xs text-ink/40 mb-3">AI-generated study notes — a starting point, not a replacement for your pastor or small group.</p>
          <div className="whitespace-pre-line leading-relaxed text-sm">{result.text}</div>
        </section>
      )}
    </div>
  );
}
