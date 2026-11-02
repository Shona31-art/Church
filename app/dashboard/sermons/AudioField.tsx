"use client";

import { useRef, useState } from "react";
import { Mic, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";
import { requestSermonAudioUpload } from "./actions";
import { mediaEmbed, playableFileUrl } from "@/lib/media";

const MAX_BYTES = 50 * 1024 * 1024;

/** Some phones report no type (or an odd one) for audio files; work it out from the name. */
function audioType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type === "audio/x-m4a" ? "audio/mp4" : file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/opus", webm: "audio/webm" } as Record<string, string>)[ext ?? ""] ?? "";
}

/**
 * The sermon's audio: upload a recording from the phone, or paste a link.
 * The file goes straight from the phone to storage; the field then holds its link.
 */
export function AudioField({ initial, error }: { initial: string; error?: string }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProblem(null);
    if (file.size > MAX_BYTES) return setProblem("That recording is over 50 MB. Save it as MP3 or M4A (smaller), or split it in two.");
    const type = audioType(file);
    setBusy(`Uploading ${file.name}… keep this page open`);
    try {
      const ticket = await requestSermonAudioUpload({ contentType: type, bytes: file.size });
      if (!ticket.ok) return setProblem(ticket.error);
      const { error: uploadError } = await createClient().storage.from("sermon-audio").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: type });
      if (uploadError) {
        console.error("[sermons] audio upload failed:", uploadError.message);
        return setProblem("The upload didn't finish — check your connection and try again.");
      }
      setUrl(ticket.url);
      showToast("Recording uploaded. Save the sermon to keep it.", "success");
    } catch {
      setProblem("The upload didn't finish — check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const isUpload = url.includes("/storage/v1/object/public/sermon-audio/");
  const embed = mediaEmbed(url);
  const file = embed ? null : playableFileUrl(url);

  return (
    <FormField label="Audio" htmlFor="audio_url" optional error={problem ?? error} hint="Upload a recording from your phone (MP3, M4A, WAV, AAC or OGG, up to 50 MB), or paste a link from SoundCloud, Spotify, YouTube, Google Drive or Dropbox.">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy ? <Upload aria-hidden className="h-4 w-4 animate-pulse" /> : <Mic aria-hidden className="h-4 w-4" />} {busy ? "Uploading…" : url ? "Upload a different recording" : "Upload audio"}
          </button>
          {url && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setUrl("")} disabled={busy !== null}>
              <X aria-hidden className="h-4 w-4" /> Remove audio
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus" className="sr-only" onChange={onPick} aria-label="Choose a recording" />
        {busy && <p className="text-sm text-ink/70">{busy}</p>}
        {file && !busy && <audio controls preload="metadata" src={file} className="w-full" />}
        {embed && !busy && <p className="text-xs text-success">{embed.service} link — it will play right on the sermon page.</p>}
        <input
          id="audio_url"
          name="audio_url"
          type="url"
          inputMode="url"
          placeholder="…or paste a link: SoundCloud, Spotify, Google Drive…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={`input ${isUpload ? "text-xs text-ink/60" : ""}`}
          aria-invalid={Boolean(problem ?? error)}
        />
      </div>
    </FormField>
  );
}
