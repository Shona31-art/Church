"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, SendHorizontal, Square, Trash2 } from "lucide-react";
import { MAX_VOICE_BYTES, MAX_VOICE_MS, formatDuration, pickRecordingFormat } from "@/lib/chat";
import { VoicePlayer } from "./VoicePlayer";

export interface RecordedVoiceNote {
  blob: Blob;
  durationMs: number;
  extension: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "review"; note: RecordedVoiceNote; previewUrl: string }
  | { kind: "sending"; note: RecordedVoiceNote; previewUrl: string };

/**
 * Tap the mic to record (up to 2 minutes; it stops itself), tap stop to
 * review, then send or discard. A tap-to-start flow rather than press-and-
 * hold, so it works with a keyboard and screen reader too.
 *
 * If sending fails the note stays here with the error, so it can be retried
 * rather than silently lost.
 */
export function VoiceRecorder({
  onSend,
  onActiveChange,
}: {
  /** Uploads and posts the note; resolves to an error message, or null on success. */
  onSend: (note: RecordedVoiceNote) => Promise<string | null>;
  /** Lets the composer hide the text box while a note is being recorded or reviewed. */
  onActiveChange: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);

  useEffect(() => onActiveChange(phase.kind !== "idle"), [phase.kind, onActiveChange]);

  // Tick the timer and stop automatically at the limit.
  useEffect(() => {
    if (phase.kind !== "recording") return;
    const timer = setInterval(() => {
      const ms = Date.now() - phase.startedAt;
      setElapsed(ms);
      if (ms >= MAX_VOICE_MS) recorderRef.current?.stop();
    }, 200);
    return () => clearInterval(timer);
  }, [phase]);

  // Release the microphone and preview URL if the person navigates away.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onActiveChange(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    []
  );

  function releaseMic() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setError("This browser can't record audio. Try Chrome, Edge or Safari.");
    }
    const format = pickRecordingFormat((mime) => MediaRecorder.isTypeSupported(mime));
    if (!format) return setError("This browser can't record audio. Try Chrome, Edge or Safari.");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = (e as DOMException)?.name;
      return setError(
        name === "NotAllowedError"
          ? "Microphone access is blocked. Allow it in your browser's site settings to send voice notes."
          : name === "NotFoundError"
          ? "No microphone found on this device."
          : "Couldn't start the microphone. Try again."
      );
    }
    streamRef.current = stream;

    // 32 kbps is clear for speech and keeps 2 minutes well under 1 MB.
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: 32_000 });
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;
    const startedAt = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      releaseMic();
      if (discardRef.current) return setPhase({ kind: "idle" });
      const durationMs = Math.min(Date.now() - startedAt, MAX_VOICE_MS);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || format.mimeType });
      if (durationMs < 700 || blob.size === 0) {
        setError("That was too short — tap the mic and speak for at least a second.");
        return setPhase({ kind: "idle" });
      }
      if (blob.size > MAX_VOICE_BYTES) {
        setError("That recording is too large to send. Try a shorter voice note.");
        return setPhase({ kind: "idle" });
      }
      setPhase({ kind: "review", note: { blob, durationMs, extension: format.extension }, previewUrl: URL.createObjectURL(blob) });
    };

    recorder.start(250);
    setElapsed(0);
    setPhase({ kind: "recording", startedAt });
  }

  function stop() {
    recorderRef.current?.stop();
  }

  function discard() {
    setError(null);
    if (phase.kind === "recording") {
      discardRef.current = true;
      recorderRef.current?.stop();
      return;
    }
    if (phase.kind === "review") URL.revokeObjectURL(phase.previewUrl);
    setPhase({ kind: "idle" });
  }

  async function send() {
    if (phase.kind !== "review") return;
    const { note, previewUrl } = phase;
    setError(null);
    setPhase({ kind: "sending", note, previewUrl });
    const failure = await onSend(note);
    if (failure) {
      setError(failure);
      setPhase({ kind: "review", note, previewUrl });
      return;
    }
    URL.revokeObjectURL(previewUrl);
    setPhase({ kind: "idle" });
  }

  if (phase.kind === "idle") {
    return (
      <>
        <button type="button" onClick={start} className="btn-primary btn-icon h-11 w-11 rounded-full" aria-label="Record a voice note">
          <Mic aria-hidden className="h-4 w-4" />
        </button>
        {error && (
          <p role="alert" className="absolute bottom-full left-3 right-3 mb-1 text-xs text-danger">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={discard} disabled={phase.kind === "sending"} className="btn-ghost btn-icon h-11 w-11 rounded-full text-danger" aria-label="Discard voice note">
          <Trash2 aria-hidden className="h-4 w-4" />
        </button>

        <div className="flex h-11 flex-1 items-center gap-3 rounded-2xl border border-line-strong bg-surface px-3">
          {phase.kind === "recording" ? (
            <>
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-danger motion-safe:animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
              <span className="ml-auto tabular text-sm text-ink/60">
                {formatDuration(elapsed)} / {formatDuration(MAX_VOICE_MS)}
              </span>
              <span className="sr-only" role="status">
                Recording started. Press stop when you&apos;re done.
              </span>
            </>
          ) : (
            <VoicePlayer src={phase.previewUrl} durationMs={phase.note.durationMs} />
          )}
        </div>

        {phase.kind === "recording" ? (
          <button type="button" onClick={stop} className="btn-primary btn-icon h-11 w-11 rounded-full" aria-label="Stop recording">
            <Square aria-hidden className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={phase.kind === "sending"}
            className="btn-primary btn-icon h-11 w-11 rounded-full"
            aria-label={error ? "Retry sending voice note" : "Send voice note"}
          >
            <SendHorizontal aria-hidden className={`h-4 w-4 ${phase.kind === "sending" ? "animate-pulse" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
