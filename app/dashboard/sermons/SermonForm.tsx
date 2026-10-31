"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useFormState } from "react-dom";
import { saveSermon } from "./actions";
import { AudioField } from "./AudioField";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";

export interface SermonValues {
  id: string;
  updated_at: string;
  title: string;
  speaker: string | null;
  sermon_date: string;
  audio_url: string | null;
  video_url: string | null;
  transcript: string | null;
  ai_summary: string | null;
  scripture_refs: string[] | null;
  discussion_questions: string[] | null;
  prayer_points: string[] | null;
}

export function SermonForm({ sermon, aiAvailable, today }: { sermon?: SermonValues; aiAvailable: boolean; today: string }) {
  const [state, action] = useFormState(saveSermon, null);
  const fe = state?.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => state?.values?.[name] ?? fallback ?? "";
  const joined = (arr: string[] | null | undefined) => (arr ?? []).join("\n");

  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="space-y-6 max-w-2xl" noValidate>
      {sermon && (
        <>
          <input type="hidden" name="sermon_id" value={sermon.id} />
          <input type="hidden" name="updated_at" value={sermon.updated_at} />
        </>
      )}
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <fieldset className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5">
        <legend className="sr-only">Sermon details</legend>
        <RequiredNote />
        <FormField label="Title" htmlFor="title" required error={fe.title}>
          <input id="title" name="title" required maxLength={200} defaultValue={v("title", sermon?.title)} className="input" aria-invalid={Boolean(fe.title)} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Speaker" htmlFor="speaker" optional>
            <input id="speaker" name="speaker" maxLength={120} defaultValue={v("speaker", sermon?.speaker)} className="input" />
          </FormField>
          <FormField label="Date preached" htmlFor="sermon_date" required error={fe.sermon_date}>
            <input id="sermon_date" name="sermon_date" type="date" required defaultValue={v("sermon_date", sermon?.sermon_date ?? today)} className="input" aria-invalid={Boolean(fe.sermon_date)} />
          </FormField>
        </div>
        <FormField label="Video link" htmlFor="video_url" optional error={fe.video_url} hint="YouTube links play right on the sermon page.">
          <input id="video_url" name="video_url" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" defaultValue={v("video_url", sermon?.video_url)} className="input" aria-invalid={Boolean(fe.video_url)} />
        </FormField>
        <AudioField initial={v("audio_url", sermon?.audio_url)} error={fe.audio_url} />
      </fieldset>

      {/* Opens and closes; open already when there are notes or a problem to fix. */}
      <details
        className="card-elevated group rounded-2xl p-5 sm:p-6 [&_summary::-webkit-details-marker]:hidden"
        open={Boolean(
          fe.transcript || fe.summary || fe.scripture_refs || fe.discussion_questions || fe.prayer_points ||
            sermon?.transcript || sermon?.ai_summary || (sermon?.scripture_refs?.length ?? 0) > 0 || (sermon?.discussion_questions?.length ?? 0) > 0 || (sermon?.prayer_points?.length ?? 0) > 0
        )}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Study notes for small groups</span>
            <span className="block text-xs text-ink/60">Transcript, summary, scriptures, discussion questions and prayer points (optional)</span>
          </span>
          <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-ink/60 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5 space-y-5">
        <FormField label="Transcript" htmlFor="transcript" optional error={fe.transcript}>
          <textarea id="transcript" name="transcript" rows={6} maxLength={100000} defaultValue={v("transcript", sermon?.transcript)} className="input" />
        </FormField>
        {aiAvailable ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="use_ai" defaultChecked={!sermon} className="mt-1 h-4 w-4" />
            <span>
              Use AI to write the summary, scriptures, questions and prayer points from the transcript
              <span className="block text-xs text-ink/60">Replaces the fields below. Check the result before sharing it.</span>
            </span>
          </label>
        ) : (
          <p className="text-xs text-ink/60">AI summaries aren&apos;t switched on for this app, so fill these in by hand (or leave them blank).</p>
        )}
        <FormField label="Summary" htmlFor="summary" optional>
          <textarea id="summary" name="summary" rows={3} maxLength={3000} defaultValue={v("summary", sermon?.ai_summary)} className="input" />
        </FormField>
        <FormField label="Scripture references" htmlFor="scripture_refs" optional hint="One per line, e.g. Romans 8:28">
          <textarea id="scripture_refs" name="scripture_refs" rows={3} defaultValue={v("scripture_refs", joined(sermon?.scripture_refs))} className="input" />
        </FormField>
        <FormField label="Discussion questions" htmlFor="discussion_questions" optional hint="One per line">
          <textarea id="discussion_questions" name="discussion_questions" rows={4} defaultValue={v("discussion_questions", joined(sermon?.discussion_questions))} className="input" />
        </FormField>
        <FormField label="Prayer points" htmlFor="prayer_points" optional hint="One per line">
          <textarea id="prayer_points" name="prayer_points" rows={4} defaultValue={v("prayer_points", joined(sermon?.prayer_points))} className="input" />
        </FormField>
        </div>
      </details>

      <FormActions>
        <PendingButton pendingLabel="Saving…">{sermon ? "Save changes" : "Publish sermon"}</PendingButton>
        <Link href={sermon ? `/dashboard/sermons/${sermon.id}` : "/dashboard/sermons"} className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
