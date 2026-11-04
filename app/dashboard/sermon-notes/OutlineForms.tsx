"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { Check, Eye, NotebookPen } from "lucide-react";
import { keepInJournal, saveOutline } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";
import { blankCount, parseOutline, sameAnswer } from "@/lib/sermon-notes";

export interface OutlineValues {
  id: string;
  title: string;
  speaker: string | null;
  sermon_date: string;
  scripture: string | null;
  body: string;
  published: boolean;
}

const EXAMPLE = `1. God's grace is [[free]] — we can't earn it (Ephesians 2:8).
2. Grace teaches us to say [[no]] to ungodliness (Titus 2:12).
3. This week: thank God for one [[gift]] every day.`;

/** Pastors: write the notes; [[word]] becomes a blank. */
export function OutlineForm({ outline, today }: { outline?: OutlineValues; today: string }) {
  const [state, action] = useFormState(saveOutline, null);
  const v = (k: string, f: string | null | undefined) => state?.values?.[k] ?? f ?? "";
  const [body, setBody] = useState(v("body", outline?.body));
  const blanks = blankCount(body);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="card-elevated max-w-3xl space-y-5 rounded-2xl p-5 sm:p-6" noValidate>
      {outline && <input type="hidden" name="id" value={outline.id} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Sermon title" htmlFor="title" required error={fe.title}>
        <input id="title" name="title" required maxLength={160} defaultValue={v("title", outline?.title)} className="input" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField label="Date" htmlFor="sermon_date" required error={fe.sermon_date}>
          <input id="sermon_date" name="sermon_date" type="date" required defaultValue={v("sermon_date", outline?.sermon_date ?? today)} className="input" />
        </FormField>
        <FormField label="Preacher" htmlFor="speaker" optional>
          <input id="speaker" name="speaker" maxLength={120} defaultValue={v("speaker", outline?.speaker)} className="input" />
        </FormField>
        <FormField label="Scripture" htmlFor="scripture" optional>
          <input id="scripture" name="scripture" maxLength={200} defaultValue={v("scripture", outline?.scripture)} className="input" placeholder="e.g. Titus 2:11–14" />
        </FormField>
      </div>
      <FormField
        label="Notes"
        htmlFor="body"
        required
        error={fe.body}
        hint={
          <>
            Put a word in double square brackets to make it a blank: <code className="rounded bg-ink/10 px-1">[[grace]]</code>. {blanks ? `${blanks} blank${blanks === 1 ? "" : "s"} so far.` : ""}
          </>
        }
      >
        <textarea id="body" name="body" rows={14} maxLength={20000} required value={body} onChange={(e) => setBody(e.target.value)} placeholder={EXAMPLE} className="input leading-relaxed" />
      </FormField>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="published" defaultChecked={state?.values ? state.values.published === "on" : outline?.published ?? true} className="h-4 w-4" />
        Show to the church
      </label>
      <FormActions>
        <PendingButton>{outline ? "Save changes" : "Save notes"}</PendingButton>
        <Link href={outline ? `/dashboard/sermon-notes/${outline.id}` : "/dashboard/sermon-notes"} className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

/** Members: fill in the blanks during the service, then keep the notes in the journal. */
export function FillInNotes({ id, body, journal }: { id: string; body: string; journal: boolean }) {
  const parts = useMemo(() => parseOutline(body), [body]);
  const total = parts.filter((p) => "blank" in p).length;
  const key = `grace-sermon-notes-${id}`;
  const [answers, setAnswers] = useState<string[]>([]);
  const [thoughts, setThoughts] = useState("");
  const [reveal, setReveal] = useState(false);
  const [state, action] = useFormState(keepInJournal, null);

  // Keep typing safe if the phone locks or the page reloads mid-service.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      if (saved) {
        setAnswers(saved.answers ?? []);
        setThoughts(saved.thoughts ?? "");
      }
    } catch {}
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ answers, thoughts }));
    } catch {}
  }, [key, answers, thoughts]);

  const right = parts.filter((p) => "blank" in p && sameAnswer(answers[p.blank] ?? "", p.answer)).length;

  return (
    <div className="space-y-5">
      <div className="card-elevated rounded-2xl p-5 text-[17px] leading-[2.1] whitespace-pre-wrap">
        {parts.map((p, i) =>
          "text" in p ? (
            <span key={i}>{p.text}</span>
          ) : (
            <span key={i} className="inline-flex items-baseline gap-1">
              <input
                aria-label={`Blank ${p.blank + 1}`}
                value={answers[p.blank] ?? ""}
                onChange={(e) => setAnswers((a) => Object.assign([...a], { [p.blank]: e.target.value }))}
                className={`mx-0.5 inline-block rounded-md border-b-2 bg-gold/10 px-2 py-0 text-center font-semibold outline-none focus:border-ember ${sameAnswer(answers[p.blank] ?? "", p.answer) ? "border-success" : "border-gold"}`}
                style={{ width: `${Math.max(5, p.answer.length + 2)}ch` }}
                autoCapitalize="none"
                autoComplete="off"
              />
              {reveal && !sameAnswer(answers[p.blank] ?? "", p.answer) && <span className="text-sm font-semibold text-ember">({p.answer})</span>}
            </span>
          )
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">
            {right} of {total} filled in
            {right === total && <Check aria-hidden className="ml-1 inline h-4 w-4 text-success" />}
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setReveal((r) => !r)}>
            <Eye aria-hidden className="h-4 w-4" /> {reveal ? "Hide answers" : "Show answers"}
          </button>
        </div>
      )}

      <FormField label="My thoughts" htmlFor="thoughts" optional hint="What is God saying to you? Only you see this.">
        <textarea id="thoughts" rows={4} maxLength={5000} value={thoughts} onChange={(e) => setThoughts(e.target.value)} className="input" />
      </FormField>

      {journal ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="answers" value={JSON.stringify(Array.from({ length: total }, (_, i) => answers[i] ?? ""))} />
          <input type="hidden" name="thoughts" value={thoughts} />
          {state?.error && <Alert tone="error">{state.error}</Alert>}
          {state?.ok ? (
            <Alert tone="success" title="Kept in your journal">
              <Link href="/dashboard/journal" className="underline">
                Open your journal
              </Link>{" "}
              to read them again.
            </Alert>
          ) : (
            <PendingButton pendingLabel="Saving…">
              <NotebookPen aria-hidden className="h-4 w-4" /> Keep in my journal
            </PendingButton>
          )}
        </form>
      ) : (
        <p className="text-xs text-ink/60">Your answers are kept on this phone.</p>
      )}
    </div>
  );
}
