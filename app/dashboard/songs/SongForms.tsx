"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Copy, Minus, Plus } from "lucide-react";
import { createSong, importSongs, setWorshipTeam, updateSong } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";
import { parseSongList } from "@/lib/songs";

export interface SongValues {
  id: string;
  title: string;
  author: string | null;
  song_key: string | null;
  lyrics: string;
}

/** Add or edit a song. */
export function SongForm({ song }: { song?: SongValues }) {
  const [state, action] = useFormState(song ? updateSong : createSong, null);
  const v = (name: string, fallback: string | null | undefined) => state?.values?.[name] ?? fallback ?? "";
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="card-elevated max-w-2xl space-y-5 rounded-2xl p-5 sm:p-6">
      {song && <input type="hidden" name="id" value={song.id} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Song title" htmlFor="title" required>
        <input id="title" name="title" required maxLength={200} defaultValue={v("title", song?.title)} className="input" placeholder="e.g. Way Maker" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <FormField label="Written by" htmlFor="author" optional>
          <input id="author" name="author" maxLength={200} defaultValue={v("author", song?.author)} className="input" placeholder="e.g. Sinach" />
        </FormField>
        <FormField label="Key" htmlFor="song_key" optional>
          <input id="song_key" name="song_key" maxLength={12} defaultValue={v("song_key", song?.song_key)} className="input" placeholder="e.g. G" />
        </FormField>
      </div>
      <FormField label="Lyrics" htmlFor="lyrics" hint="Leave an empty line between verses and the chorus. You can label them, e.g. “Chorus”.">
        <textarea id="lyrics" name="lyrics" rows={16} maxLength={20000} defaultValue={v("lyrics", song?.lyrics)} className="input font-[inherit] leading-relaxed" />
      </FormField>
      <FormActions>
        <PendingButton>{song ? "Save changes" : "Add song"}</PendingButton>
        <Link href={song ? `/dashboard/songs/${song.id}` : "/dashboard/songs"} className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

const IMPORT_EXAMPLE = `Way Maker
Key: E
By: Sinach
You are here, moving in our midst
I worship You, I worship You
---
Goodness of God
I love You, Lord
Oh Your mercy never fails me`;

/** Paste many songs at once (e.g. copied out of EasyWorship). */
export function ImportForm() {
  const [state, action] = useFormState(importSongs, null);
  const [text, setText] = useState(state?.values?.songs ?? "");
  const count = text.trim() ? parseSongList(text).length : 0;
  return (
    <form action={action} className="card-elevated max-w-3xl space-y-4 rounded-2xl p-5 sm:p-6">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div className="rounded-xl bg-ink/[0.04] p-4 text-sm">
        <p className="font-semibold">How to lay it out</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink/70">
          <li>The song title on the first line, then its lyrics.</li>
          <li>
            A line with three dashes <code className="rounded bg-ink/10 px-1">---</code> between songs.
          </li>
          <li>Optional: “Key: G” or “By: writer” straight under the title.</li>
          <li>Songs already in your list are skipped, so it’s safe to import twice.</li>
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-secondary cursor-pointer">
          <input
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) return showToast("That file is too big — 2 MB at most.", "error");
              setText(await file.text());
              showToast(`Loaded ${file.name}. Check the songs below, then import.`);
            }}
          />
          Choose a .txt file
        </label>
        <span className="text-sm text-ink/60">or paste the songs below</span>
      </div>
      <FormField label="Songs" htmlFor="songs">
        <textarea id="songs" name="songs" rows={18} value={text} onChange={(e) => setText(e.target.value)} placeholder={IMPORT_EXAMPLE} className="input font-mono text-sm" />
      </FormField>
      <FormActions>
        <PendingButton pendingLabel="Importing…">{count ? `Import ${count} ${count === 1 ? "song" : "songs"}` : "Import"}</PendingButton>
        <Link href="/dashboard/songs" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

/** Pastors and church admins pick which department is the worship team. */
export function WorshipTeamForm({ departments, current }: { departments: { id: string; name: string }[]; current: string | null }) {
  const [state, action] = useFormState(setWorshipTeam, null);
  useEffect(() => {
    if (state?.ok) showToast("Worship team saved.");
  }, [state]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor="department_id" className="label">
          Worship team
        </label>
        <select id="department_id" name="department_id" defaultValue={current ?? ""} className="input">
          <option value="">No department (only pastors and admins edit)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <PendingButton className="btn-secondary">Save</PendingButton>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}

/** Lyrics with bigger / smaller text and copy, for reading along in a service. */
export function LyricsView({ title, lyrics }: { title: string; lyrics: string }) {
  const [size, setSize] = useState(1.15);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("lyrics-size"));
      if (saved >= 0.9 && saved <= 2.2) setSize(saved);
    } catch {}
  }, []);
  function change(by: number) {
    const next = Math.min(2.2, Math.max(0.9, Math.round((size + by) * 100) / 100));
    setSize(next);
    try {
      localStorage.setItem("lyrics-size", String(next));
    } catch {}
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${lyrics}`);
      showToast("Lyrics copied.");
    } catch {
      showToast("Couldn't copy — press and hold the lyrics to copy them.", "error");
    }
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink/60">Text size</span>
        <button type="button" onClick={() => change(-0.15)} className="btn-secondary btn-icon h-9 w-9" aria-label="Smaller text">
          <Minus aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => change(0.15)} className="btn-secondary btn-icon h-9 w-9" aria-label="Bigger text">
          <Plus aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" onClick={copy} className="btn-ghost btn-sm ml-auto">
          <Copy aria-hidden className="h-4 w-4" /> Copy lyrics
        </button>
      </div>
      {lyrics ? (
        <div className="whitespace-pre-line leading-relaxed" style={{ fontSize: `${size}rem` }}>
          {lyrics}
        </div>
      ) : (
        <p className="text-ink/60">No lyrics added yet.</p>
      )}
    </div>
  );
}
