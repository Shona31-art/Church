"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { useFormState } from "react-dom";
import { draftSermonStudyNotes, saveSermon } from "./actions";
import { AudioField } from "./AudioField";
import { VideoField } from "./VideoField";
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

export function SermonForm({ sermon, aiAvailable, today, canUpload = true }: { sermon?: SermonValues; aiAvailable: boolean; today: string; canUpload?: boolean }) {
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
        <VideoField initial={v("video_url", sermon?.video_url)} error={fe.video_url} canUpload={canUpload} />
        <AudioField initial={v("audio_url", sermon?.audio_url)} error={fe.audio_url} canUpload={canUpload} />
        <MediaHostingTips />
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
        {aiAvailable ? (
          <AiStudyNotesButton />
        ) : (
          <p className="text-xs text-ink/60">AI help isn't included in your church's plan. Fill these in by hand, or leave them blank.</p>
        )}
        <FormField label="Transcript" htmlFor="transcript" optional error={fe.transcript} hint="Paste it for the best AI notes. Without it, the AI works from the title and scriptures.">
          <textarea id="transcript" name="transcript" rows={6} maxLength={100000} defaultValue={v("transcript", sermon?.transcript)} className="input" />
        </FormField>
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

/**
 * Big recordings don't have to use the church's own storage: free services
 * host them, and pasting the link here plays them on the sermon page.
 */
function MediaHostingTips() {
  return (
    <details className="rounded-xl border border-line p-4 text-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer list-none font-semibold">
        Big files? Keep them on a free service and paste the link <span className="font-normal text-ink/60">· how</span>
      </summary>
      <div className="mt-3 space-y-3 text-ink/80">
        <p>Videos and long recordings take a lot of space. These free services keep them for you, and the link plays right on the sermon page:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Video — YouTube</strong> (best): upload, set it to <em>Public</em> or <em>Unlisted</em>, then copy the link from <em>Share</em>. It plays smoothly even on slow phones. If you stream on <strong>Facebook</strong>, paste the video&apos;s link (it must be public). <strong>Vimeo</strong> works too.
          </li>
          <li>
            <strong>Audio — SoundCloud</strong> or <strong>Spotify</strong> (if your church has a podcast): copy the episode or track link from <em>Share</em>.
          </li>
          <li>
            <strong>Google Drive</strong> (video or audio): upload, choose <em>Share → General access → Anyone with the link</em>, then <em>Copy link</em>.
          </li>
          <li>
            <strong>Dropbox</strong> (video or audio): <em>Share → Copy link</em>. MP4 and MP3 files play best.
          </li>
        </ul>
        <p className="text-ink/60">Uploading straight here still works too — it just uses your church&apos;s own storage.</p>
      </div>
    </details>
  );
}


/** Fills the four study-note boxes with an AI draft, there and then, for the pastor to check before saving. */
function AiStudyNotesButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const field = (id: string) => document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement | null;
  const run = () =>
    start(async () => {
      setMessage(null);
      const result = await draftSermonStudyNotes({
        title: field("title")?.value ?? "",
        speaker: field("speaker")?.value ?? "",
        transcript: field("transcript")?.value ?? "",
        scripture: field("scripture_refs")?.value ?? "",
        summary: field("summary")?.value ?? "",
      });
      if (!result.notes) {
        setMessage({ tone: "error", text: result.error ?? "Something went wrong — please try again." });
        return;
      }
      const set = (id: string, value: string) => {
        const el = field(id);
        if (el && value) el.value = value;
      };
      set("summary", result.notes.summary);
      set("scripture_refs", result.notes.scriptureRefs.join("\n"));
      set("discussion_questions", result.notes.discussionQuestions.join("\n"));
      set("prayer_points", result.notes.prayerPoints.join("\n"));
      setMessage({ tone: "success", text: "Done — check the boxes below and change anything you like, then save." });
    });
  return (
    <div className="space-y-2 rounded-xl border border-gold/40 bg-gold/5 p-4">
      <button type="button" className="btn-primary" onClick={run} disabled={pending} aria-busy={pending}>
        <Sparkles aria-hidden className="h-4 w-4" /> {pending ? "Writing…" : "Write the study notes with AI"}
      </button>
      <p className="text-xs text-ink/60">Fills in the summary, scriptures, discussion questions and prayer points below. Check them before saving.</p>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}
