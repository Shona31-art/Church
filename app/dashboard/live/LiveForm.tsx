"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { saveLiveService } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";

export interface LiveValues {
  id: string;
  title: string;
  starts_local: string;
  stream_url: string | null;
  service_plan_id: string | null;
  outline_id: string | null;
  song_ids: string[];
  message: string | null;
}

type Option = { id: string; label: string };

export function LiveForm({ live, defaults, plans, outlines, songs }: { live?: LiveValues; defaults: { title: string; starts_local: string }; plans: Option[]; outlines: Option[]; songs: Option[] }) {
  const [state, action] = useFormState(saveLiveService, null);
  const v = (k: string, f: string | null | undefined) => state?.values?.[k] ?? f ?? "";
  const [picked, setPicked] = useState<string[]>(live?.song_ids ?? []);
  const [q, setQ] = useState("");
  const shown = useMemo(() => songs.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())).slice(0, 200), [songs, q]);
  const fe = state?.fieldErrors ?? {};
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const move = (i: number, d: number) => setPicked((p) => {
    const n = [...p];
    const j = i + d;
    if (j < 0 || j >= n.length) return p;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const songName = (id: string) => songs.find((s) => s.id === id)?.label ?? "Song";

  return (
    <form action={action} className="card-elevated max-w-3xl space-y-5 rounded-2xl p-5 sm:p-6" noValidate>
      {live && <input type="hidden" name="id" value={live.id} />}
      {picked.map((id) => (
        <input key={id} type="hidden" name="song_ids" value={id} />
      ))}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
        <FormField label="Service" htmlFor="title" required error={fe.title}>
          <input id="title" name="title" required maxLength={160} defaultValue={v("title", live?.title ?? defaults.title)} className="input" />
        </FormField>
        <FormField label="Starts" htmlFor="starts_at" required error={fe.starts_at}>
          <input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={v("starts_at", live?.starts_local ?? defaults.starts_local)} className="input" />
        </FormField>
      </div>
      <FormField label="Livestream link" htmlFor="stream_url" optional error={fe.stream_url} hint="YouTube or Facebook. For the video to play inside Grace, use the link to this service's live video (Share → Copy link), not your channel page.">
        <input id="stream_url" name="stream_url" type="url" inputMode="url" maxLength={500} defaultValue={v("stream_url", live?.stream_url)} className="input" placeholder="https://youtube.com/live/…" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Order of service" htmlFor="service_plan_id" optional hint="From the Service Planner (published plans show to everyone).">
          <select id="service_plan_id" name="service_plan_id" defaultValue={v("service_plan_id", live?.service_plan_id)} className="input">
            <option value="">None</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Sermon notes" htmlFor="outline_id" optional>
          <select id="outline_id" name="outline_id" defaultValue={v("outline_id", live?.outline_id)} className="input">
            <option value="">None</option>
            {outlines.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Songs, in order</legend>
        {picked.length > 0 && (
          <ol className="space-y-1">
            {picked.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                <span className="w-5 text-ink/50">{i + 1}.</span>
                <span className="flex-1">{songName(id)}</span>
                <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, -1)} aria-label={`Move ${songName(id)} up`} disabled={i === 0}>
                  ↑
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, 1)} aria-label={`Move ${songName(id)} down`} disabled={i === picked.length - 1}>
                  ↓
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => toggle(id)} aria-label={`Remove ${songName(id)}`}>
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
        {songs.length ? (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a song to add" className="input" aria-label="Find a song" />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-line p-1">
              {shown.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-ink/5">
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4" />
                  {s.label}
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-ink/60">
            Add songs under <Link href="/dashboard/songs" className="link">Songs</Link> to show their words here.
          </p>
        )}
      </fieldset>

      <FormField label="Welcome message" htmlFor="message" optional>
        <textarea id="message" name="message" rows={3} maxLength={1000} defaultValue={v("message", live?.message)} className="input" placeholder="Welcome! Say hi in the church chat and let us know you're watching." />
      </FormField>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="notify" defaultChecked={!live} className="h-4 w-4" />
        Tell everyone now (a notification: “🔴 We're live”)
      </label>
      <FormActions>
        <PendingButton>{live ? "Save changes" : "Save live service"}</PendingButton>
        <Link href="/dashboard/live" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
