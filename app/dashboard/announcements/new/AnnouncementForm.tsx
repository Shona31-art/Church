"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { createAnnouncement, draftAnnouncementWithAi, AnnouncementChannel } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";

const CHANNELS: { value: AnnouncementChannel; label: string }[] = [
  { value: "app", label: "This app" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "bulletin", label: "Printed bulletin" },
];

export function AnnouncementForm({
  departments,
  canPostChurchWide,
}: {
  departments: { id: string; name: string }[];
  canPostChurchWide: boolean;
}) {
  const [state, formAction] = useFormState(createAnnouncement, null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<AnnouncementChannel>("app");
  const [drafting, setDrafting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleDraft() {
    setDrafting(true);
    setAiError(null);
    setCopied(false);
    try {
      const result = await draftAnnouncementWithAi(title, body, channel);
      if (result.error) setAiError(result.error);
      else if (result.text) setBody(result.text);
    } catch {
      setAiError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
    } catch {
      setAiError("Couldn't copy automatically — select the text and copy it manually.");
    }
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <Link href="/dashboard/announcements" className="text-sm text-ink/50 hover:text-ink">← Announcements</Link>
      <h1 className="text-2xl font-semibold">New announcement</h1>

      {state?.error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">⚠ {state.error}</p>}

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">Title</label>
        <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className="w-full border border-ink/20 rounded-lg px-4 py-3" />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium mb-1">Announcement</label>
        <textarea
          id="body"
          name="body"
          value={body}
          onChange={(e) => { setBody(e.target.value); setCopied(false); }}
          placeholder="What's happening, when, where, and who it's for. Rough notes are fine — the AI writer can polish them."
          required
          rows={7}
          maxLength={5000}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
      </div>

      <div className="card-elevated rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium">✨ AI writer</p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="channel" className="block text-xs text-ink/60 mb-1">Write it for</label>
            <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value as AnnouncementChannel)} className="border border-ink/20 rounded-lg px-3 py-2 text-sm">
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={handleDraft} disabled={drafting} className="text-sm border border-ink/20 rounded-lg px-3 py-2 hover:bg-ink/5 disabled:opacity-40">
            {drafting ? "Writing…" : "Polish my notes"}
          </button>
          {channel !== "app" && body && (
            <button type="button" onClick={handleCopy} className="text-sm border border-ink/20 rounded-lg px-3 py-2 hover:bg-ink/5">
              {copied ? "✓ Copied" : "Copy text"}
            </button>
          )}
        </div>
        <p className="text-xs text-ink/40">
          The AI only uses the details you give it and marks anything missing like [time]. Check it before posting.
          {channel !== "app" && " For WhatsApp, email or the bulletin: copy the text and send it there — posting below still publishes it in the app."}
        </p>
        {aiError && <p role="alert" className="text-xs text-red-700">⚠ {aiError}</p>}
      </div>

      {canPostChurchWide ? (
        <>
          <div>
            <label htmlFor="department_id" className="block text-sm font-medium mb-1">Audience</label>
            <select id="department_id" name="department_id" className="w-full border border-ink/20 rounded-lg px-4 py-3">
              <option value="">Church-wide</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} only</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pinned" /> Pin to the top
          </label>
        </>
      ) : (
        <p className="text-sm text-ink/50">This will be posted to your department only.</p>
      )}

      <PendingButton className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50" pendingLabel="Posting…">
        Post announcement
      </PendingButton>
    </form>
  );
}
