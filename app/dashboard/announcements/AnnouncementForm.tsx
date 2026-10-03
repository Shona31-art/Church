"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { saveAnnouncement, draftAnnouncementWithAi, type AnnouncementChannel } from "./actions";
import { Alert } from "@/components/ui/Alert";
import { FormField, RequiredNote } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";

const CHANNELS: { value: AnnouncementChannel; label: string }[] = [
  { value: "app", label: "This app" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "bulletin", label: "Printed bulletin" },
];

export interface AnnouncementValues {
  id: string;
  updated_at: string;
  title: string;
  body: string;
  department_id: string | null;
  pinned: boolean;
  status: string;
}

export function AnnouncementForm({
  departments,
  canPostChurchWide,
  aiAvailable,
  announcement,
}: {
  departments: { id: string; name: string }[];
  canPostChurchWide: boolean;
  aiAvailable: boolean;
  announcement?: AnnouncementValues;
}) {
  const [state, formAction] = useFormState(saveAnnouncement, null);
  const fe = state?.fieldErrors ?? {};
  // Controlled because the AI writer fills them in. State survives failed
  // saves, so nothing typed is ever lost.
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [channel, setChannel] = useState<AnnouncementChannel>("app");
  const [drafting, setDrafting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleDraft() {
    setDrafting(true);
    setAiError(null);
    try {
      const result = await draftAnnouncementWithAi(title, body, channel);
      if (result.error) setAiError(result.error);
      else if (result.text) {
        setBody(result.text);
        showToast("Draft written — check it before posting.", "info");
      }
    } catch {
      setAiError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      showToast("Copied to clipboard.");
    } catch {
      setAiError("Couldn't copy automatically — select the text and copy it manually.");
    }
  }

  const isPublished = announcement?.status === "published";

  return (
    <form action={formAction} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-2xl" noValidate>
      {announcement && (
        <>
          <input type="hidden" name="announcement_id" value={announcement.id} />
          <input type="hidden" name="updated_at" value={announcement.updated_at} />
        </>
      )}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />

      <FormField label="Title" htmlFor="title" required error={fe.title}>
        <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className="input" aria-invalid={Boolean(fe.title)} />
      </FormField>

      <FormField label="Announcement" htmlFor="body" required error={fe.body} hint={`${body.length.toLocaleString()} / 5,000 characters`}>
        <textarea
          id="body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's happening, when, where, and who it's for. Rough notes are fine — the AI writer can polish them."
          required
          rows={8}
          maxLength={5000}
          className="input"
          aria-invalid={Boolean(fe.body)}
        />
      </FormField>

      {aiAvailable && (
        <div className="rounded-xl border border-line bg-parchment p-4 space-y-3">
          <p className="text-sm font-medium">✨ AI writer</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="channel" className="block text-xs text-ink/60 mb-1">
                Write it for
              </label>
              <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value as AnnouncementChannel)} className="input w-auto">
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleDraft} disabled={drafting} className="btn-secondary">
              {drafting ? "Writing…" : "Polish my notes"}
            </button>
            {channel !== "app" && body && (
              <button type="button" onClick={handleCopy} className="btn-secondary">
                Copy text
              </button>
            )}
          </div>
          <p className="text-xs text-ink/60">
            The AI only uses the details you give it and marks anything missing like [time]. Check it before posting.
            {channel !== "app" && " For WhatsApp, email or the bulletin: copy the text and send it there."}
          </p>
          {aiError && <Alert tone="error">{aiError}</Alert>}
        </div>
      )}

      {canPostChurchWide ? (
        <>
          <FormField label="Who should see it?" htmlFor="department_id">
            <select id="department_id" name="department_id" defaultValue={announcement?.department_id ?? ""} className="input">
              <option value="">Everyone in the church</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} department only
                </option>
              ))}
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pinned" defaultChecked={announcement?.pinned} className="h-4 w-4" /> Pin to the top of the list
          </label>
        </>
      ) : (
        <Alert tone="info">This will be visible to your department only.</Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <IntentButton intent="publish" className="btn-primary" pendingLabel="Publishing…">
          {isPublished ? "Save changes" : "Publish"}
        </IntentButton>
        {!isPublished && (
          <IntentButton intent="draft" className="btn-secondary" pendingLabel="Saving…">
            Save as draft
          </IntentButton>
        )}
        <Link href={announcement ? `/dashboard/announcements/${announcement.id}` : "/dashboard/announcements"} className="btn-ghost">
          Cancel
        </Link>
      </div>
      {!isPublished && <p className="text-xs text-ink/60">Drafts are only visible to you and your church&apos;s pastors and admins.</p>}
    </form>
  );
}

/** A submit button that tells the action which button was pressed. */
function IntentButton({ intent, className, pendingLabel, children }: { intent: string; className: string; pendingLabel: string; children: React.ReactNode }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("intent") === intent;
  return (
    <button type="submit" name="intent" value={intent} disabled={pending} className={className}>
      {mine ? pendingLabel : children}
    </button>
  );
}
