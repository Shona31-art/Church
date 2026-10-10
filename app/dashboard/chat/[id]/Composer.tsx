"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Reply, SendHorizontal, X } from "lucide-react";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat";
import { VoiceRecorder, type RecordedVoiceNote } from "./VoiceRecorder";

/**
 * The message box. Enter sends, Shift+Enter adds a line. Shows a banner when
 * replying to or editing a message; Escape cancels either. With an empty box
 * the send button becomes a microphone for voice notes (when `onSendVoice`
 * is given).
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  error,
  mode,
  onCancelMode,
  onSendVoice,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  mode: { kind: "reply"; name: string; preview: string } | { kind: "edit" } | null;
  onCancelMode: () => void;
  onSendVoice?: (note: RecordedVoiceNote) => Promise<string | null>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const showMic = Boolean(onSendVoice) && !value.trim() && mode?.kind !== "edit";

  // Grow with the text, up to ~6 lines, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // Jump into the box when starting a reply or an edit.
  useEffect(() => {
    if (mode) ref.current?.focus();
  }, [mode]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    } else if (e.key === "Escape" && mode) {
      e.preventDefault();
      onCancelMode();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative border-t border-line bg-surface/80 p-3 backdrop-blur"
    >
      {error && (
        <p role="alert" className="mb-2 text-xs text-danger">
          {error}
        </p>
      )}

      {mode && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-[3px] border-gold bg-ink/[0.04] px-3 py-2 text-xs">
          {mode.kind === "reply" ? <Reply aria-hidden className="mt-0.5 h-3.5 w-3.5 text-gold" /> : <Pencil aria-hidden className="mt-0.5 h-3.5 w-3.5 text-gold" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{mode.kind === "reply" ? `Replying to ${mode.name}` : "Editing message"}</p>
            {mode.kind === "reply" && <p className="truncate text-ink/60">{mode.preview}</p>}
          </div>
          <button type="button" onClick={onCancelMode} className="rounded-full p-0.5 text-ink/50 hover:bg-ink/5 hover:text-ink" aria-label={mode.kind === "reply" ? "Cancel reply" : "Cancel edit"}>
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label htmlFor="chat-message" className="sr-only">
          {mode?.kind === "edit" ? "Edit message" : "Message"}
        </label>
        <textarea
          hidden={voiceActive}
          ref={ref}
          id="chat-message"
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Type a message…"
          autoComplete="off"
          className="input max-h-40 flex-1 resize-none rounded-2xl"
        />
        {showMic && onSendVoice ? (
          <VoiceRecorder onSend={onSendVoice} onActiveChange={setVoiceActive} />
        ) : (
          <button type="submit" disabled={busy || !value.trim()} className="btn-primary btn-icon h-11 w-11 rounded-full" aria-label={mode?.kind === "edit" ? "Save edit" : "Send"}>
            <SendHorizontal aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}
