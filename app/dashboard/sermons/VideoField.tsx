"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Video, X } from "lucide-react";
import { FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";
import { mediaEmbed, playableFileUrl } from "@/lib/media";
import { requestSermonVideoUpload } from "./actions";

const MAX_MB = 1024; // keep in step with actions.ts and sermon_video.sql

/** Phones sometimes report no type (or a generic one) for videos; work it out from the name. */
function videoType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ({ mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm" } as Record<string, string>)[ext ?? ""] ?? "";
}

/**
 * The sermon's video: upload a file from the phone or computer, or paste a
 * link (YouTube plays on the page). The file goes straight from the device to
 * storage, with a progress bar; the field then holds its link.
 */
export function VideoField({ initial, error, canUpload = true }: { initial: string; error?: string; canUpload?: boolean }) {
  const [url, setUrl] = useState(initial);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const busy = progress !== null;

  // Leaving mid-upload would lose it: ask first.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProblem(null);
    if (file.size > MAX_MB * 1024 * 1024) return setProblem(`That video is over ${MAX_MB / 1024} GB. Export it at a lower quality (720p is plenty), or post it on YouTube and paste the link.`);
    const type = videoType(file);
    setProgress(0);
    try {
      const ticket = await requestSermonVideoUpload({ contentType: type, bytes: file.size });
      if (!ticket.ok) return setProblem(ticket.error);
      const result = await send(ticket.uploadUrl, file, type, setProgress, xhrRef);
      if (result === "cancelled") return;
      if (result !== "ok") return setProblem(result);
      setUrl(ticket.url);
      showToast("Video uploaded. Save the sermon to keep it.", "success");
    } catch {
      setProblem("The upload didn't finish — check your connection and try again.");
    } finally {
      xhrRef.current = null;
      setProgress(null);
    }
  }

  const isUpload = url.includes("/storage/v1/object/public/sermon-video/");
  const embed = mediaEmbed(url);
  const file = embed ? null : playableFileUrl(url);

  return (
    <FormField
      label="Video"
      htmlFor="video_url"
      optional
      error={problem ?? error}
      hint={
        canUpload
          ? `Upload a video (MP4 works on every phone; MOV, M4V or WebM too — up to ${MAX_MB / 1024} GB), or paste a link from YouTube, Facebook, Vimeo, Google Drive or Dropbox.`
          : "Paste a link from YouTube, Facebook, Vimeo, Google Drive or Dropbox. (Uploading videos is on Grace Plus.)"
      }
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {canUpload && (
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Upload aria-hidden className="h-4 w-4 animate-pulse" /> : <Video aria-hidden className="h-4 w-4" />}{" "}
              {busy ? "Uploading…" : url ? "Upload a different video" : "Upload video"}
            </button>
          )}
          {busy && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => xhrRef.current?.abort()}>
              Cancel upload
            </button>
          )}
          {url && !busy && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setUrl("")}>
              <X aria-hidden className="h-4 w-4" /> Remove video
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm" className="sr-only" onChange={onPick} aria-label="Choose a video" />
        {busy && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Upload progress">
              <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-ink/70">{progress}% uploaded — keep this page open.</p>
          </div>
        )}
        {file && !busy && <video controls preload="metadata" playsInline src={file} className="w-full rounded-xl" />}
        {embed && !busy && <p className="text-xs text-success">{embed.service} video — it will play right on the sermon page.</p>}
        <input
          id="video_url"
          name="video_url"
          type="url"
          inputMode="url"
          placeholder="…or paste a link: YouTube, Facebook, Vimeo, Google Drive…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={`input ${isUpload ? "text-xs text-ink/60" : ""}`}
          aria-invalid={Boolean(problem ?? error)}
        />
      </div>
    </FormField>
  );
}

/**
 * PUTs the file to the one-time storage link, reporting progress (fetch can't
 * report upload progress, so this uses XMLHttpRequest). Returns "ok",
 * "cancelled", or a message to show.
 */
function send(uploadUrl: string, file: File, type: string, onProgress: (pct: number) => void, xhrRef: React.MutableRefObject<XMLHttpRequest | null>): Promise<string> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("content-type", type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) xhr.setRequestHeader("apikey", anonKey);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve("ok");
      console.error("[sermons] video upload failed:", xhr.status, xhr.responseText);
      resolve(
        xhr.status === 413 || /maximum allowed size|too large|exceeded/i.test(xhr.responseText)
          ? "That video is bigger than your storage allows. A church admin can raise the upload limit in Supabase (Storage → Settings), or post the video on YouTube and paste the link."
          : "The upload didn't finish — check your connection and try again."
      );
    };
    xhr.onerror = () => resolve("The upload didn't finish — check your connection and try again.");
    xhr.onabort = () => resolve("cancelled");
    xhr.send(file);
  });
}
