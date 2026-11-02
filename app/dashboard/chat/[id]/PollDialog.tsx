"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { POLL_MAX_OPTIONS } from "@/lib/chat";

/** "Create poll": a question, 2–12 options, and whether people may choose more than one. */
export function PollDialog({ onCreate, onClose }: { onCreate: (question: string, options: string[], multiple: boolean) => Promise<string | null>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => ref.current?.showModal(), []);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = question.trim().length > 0 && filled.length >= 2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return setError("Add a question and at least two options.");
    setBusy(true);
    const problem = await onCreate(question.trim(), filled, multiple);
    setBusy(false);
    if (problem) return setError(problem);
    ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="poll-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
    >
      <form onSubmit={submit} className="max-h-[85vh] space-y-4 overflow-y-auto p-5" noValidate>
        <h2 id="poll-title" className="text-xl font-semibold">
          Create poll
        </h2>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="poll-question" className="label">
            Question
          </label>
          <input id="poll-question" className="input mt-1" maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question" autoFocus />
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Options</legend>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <label htmlFor={`poll-option-${i}`} className="sr-only">
                Option {i + 1}
              </label>
              <input
                id={`poll-option-${i}`}
                className="input flex-1"
                maxLength={100}
                value={o}
                placeholder={`Option ${i + 1}`}
                onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {options.length > 2 && (
                <button type="button" className="btn-ghost btn-icon" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}>
                  <X aria-hidden className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {options.length < POLL_MAX_OPTIONS && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOptions((all) => [...all, ""])}>
              <Plus aria-hidden className="h-4 w-4" /> Add option
            </button>
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="h-4 w-4" />
          Allow people to choose more than one
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !ready}>
            {busy ? "Sending…" : "Send poll"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
