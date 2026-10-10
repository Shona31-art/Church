"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CHAT_MEDIA_BUCKET, formatDuration } from "@/lib/chat";

const PLAY_EVENT = "app:voice-play";

/**
 * Plays a voice note. Files are private, so the signed link is fetched on
 * first play (Storage checks the listener is in this chat). Starting one
 * note pauses any other that's playing.
 *
 * Pass `path` for a sent note, or `src` for a local preview before sending.
 */
export function VoicePlayer({
  path,
  src,
  durationMs,
  onDark = false,
}: {
  path?: string | null;
  src?: string;
  durationMs: number;
  /** True inside my own (navy/champagne) bubble. */
  onDark?: boolean;
}) {
  const id = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(src ?? null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [position, setPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const total = durationMs / 1000;

  useEffect(() => {
    const onOtherPlay = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, [id]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (state === "playing") return audio.pause();

    let source = url;
    if (!source && path) {
      setState("loading");
      const { data, error: signError } = await createClient().storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
      if (signError || !data?.signedUrl) {
        setState("error");
        setError("Couldn't load this voice note — check your connection.");
        return;
      }
      source = data.signedUrl;
      setUrl(source);
      audio.src = source;
    }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id }));
    try {
      await audio.play();
    } catch {
      setState("error");
      setError("This voice note can't play on this device.");
    }
  }

  const muted = onDark ? "text-on-ember/70" : "text-ink/55";
  const Icon = state === "playing" ? Pause : state === "loading" ? LoaderCircle : Play;

  return (
    <div className="flex min-w-[13rem] items-center gap-3 py-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "loading"}
        aria-label={state === "playing" ? "Pause voice note" : `Play voice note, ${formatDuration(durationMs)}`}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${onDark ? "bg-on-ember/15 hover:bg-on-ember/25" : "bg-ember text-on-ember hover:bg-ember/90"}`}
      >
        <Icon aria-hidden className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""} ${state === "playing" ? "" : "translate-x-px"}`} />
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={Math.min(position, total)}
          onChange={(e) => {
            const t = Number(e.target.value);
            if (audioRef.current && url) audioRef.current.currentTime = t;
            setPosition(t);
          }}
          aria-label="Voice note position"
          aria-valuetext={`${formatDuration(position * 1000)} of ${formatDuration(durationMs)}`}
          className={`h-1 w-full cursor-pointer ${onDark ? "accent-[rgb(var(--on-ember))]" : "accent-[rgb(var(--gold))]"}`}
        />
        <p className={`mt-1 text-[11px] tabular ${muted}`}>
          {error ?? (state === "playing" || position > 0 ? `${formatDuration(position * 1000)} / ${formatDuration(durationMs)}` : formatDuration(durationMs))}
        </p>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setState("playing")}
        onPause={() => setState("paused")}
        onEnded={() => {
          setState("idle");
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onError={() => {
          if (!audioRef.current?.src) return; // no source yet (preload="none")
          setState("error");
          setError("This voice note can't play on this device.");
        }}
      />
    </div>
  );
}
