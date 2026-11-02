"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, ImagePlus, Paperclip, Pencil, Reply, SendHorizontal, Smile, X } from "lucide-react";
import { MAX_MESSAGE_LENGTH, mentionQuery } from "@/lib/chat";
import { VoiceRecorder, type RecordedVoiceNote } from "./VoiceRecorder";
import { EmojiPicker } from "./EmojiPicker";

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
  onPickPhoto,
  photoBusy = false,
  onTyping,
  typingText,
  notice,
  mentionPeople,
  onMention,
  onCreatePoll,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  mode: { kind: "reply"; name: string; preview: string } | { kind: "edit" } | null;
  onCancelMode: () => void;
  onSendVoice?: (note: RecordedVoiceNote) => Promise<string | null>;
  /** Set when photo sharing is on for this church. The typed text becomes the caption. */
  onPickPhoto?: (file: File) => void;
  photoBusy?: boolean;
  /** Called as the person types (for the "typing…" indicator). */
  onTyping?: () => void;
  /** "Alice is typing…" — shown above the box. */
  typingText?: string | null;
  /** Replaces the box entirely, e.g. "You blocked Alice" or a posting restriction. */
  notice?: React.ReactNode;
  /** Group chats: people who can be @mentioned (shows a list as you type "@"). */
  mentionPeople?: { id: string; name: string }[];
  onMention?: (id: string, name: string) => void;
  /** Opens "Create poll". */
  onCreatePoll?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const showMic = Boolean(onSendVoice) && !value.trim() && mode?.kind !== "edit";
  const [cursor, setCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mention = mentionPeople?.length && mode?.kind !== "edit" ? mentionQuery(value, cursor) : null;
  const suggestions = mention
    ? mentionPeople!.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(mention.query.toLowerCase())) || p.name.toLowerCase().startsWith(mention.query.toLowerCase())).slice(0, 6)
    : [];

  /** Puts "@Name " in place of the "@que" being typed. */
  function pickMention(person: { id: string; name: string }) {
    if (!mention) return;
    const next = `${value.slice(0, mention.start)}@${person.name} ${value.slice(cursor)}`;
    if (next.length > MAX_MESSAGE_LENGTH) return;
    onChange(next);
    onMention?.(person.id, person.name);
    const at = mention.start + person.name.length + 2;
    setCursor(at);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(at, at);
    });
  }

  // Grow with the text, up to ~6 lines, then scroll. Borders are added back
  // and the scrollbar stays hidden until it's actually needed (otherwise a
  // one-line box shows scroll arrows).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const border = el.offsetHeight - el.clientHeight;
    const wanted = el.scrollHeight + border;
    el.style.height = `${Math.min(wanted, 160)}px`;
    el.style.overflowY = wanted > 160 ? "auto" : "hidden";
  }, [value]);

  /** Inserts an emoji where the cursor is (or at the end), keeping the box focused. */
  function insertEmoji(emoji: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    if (next.length > MAX_MESSAGE_LENGTH) return;
    onChange(next);
    onTyping?.();
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  // Jump into the box when starting a reply or an edit.
  useEffect(() => {
    if (mode) ref.current?.focus();
  }, [mode]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length && ["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "ArrowDown") setMentionIndex((i) => (i + 1) % suggestions.length);
      else if (e.key === "ArrowUp") setMentionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      else pickMention(suggestions[Math.min(mentionIndex, suggestions.length - 1)]);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    } else if (e.key === "Escape" && mode) {
      e.preventDefault();
      onCancelMode();
    }
  }

  if (notice) {
    return <div className="border-t border-line bg-surface/80 p-4 text-center text-sm text-ink/70">{notice}</div>;
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
          <button type="button" onClick={onCancelMode} className="rounded-full p-0.5 text-ink/60 hover:bg-ink/5 hover:text-ink" aria-label={mode.kind === "reply" ? "Cancel reply" : "Cancel edit"}>
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Visual only: announcing every keystroke elsewhere would swamp screen readers. */}
      <p aria-hidden className="mb-1 h-4 truncate px-1 text-xs italic text-ink/60">
        {typingText}
      </p>

      {suggestions.length > 0 && (
        <ul role="listbox" aria-label="Mention someone" className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-60 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-pop">
          {suggestions.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === mentionIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(p)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${i === mentionIndex ? "bg-gold/15" : "hover:bg-ink/5"}`}
              >
                @{p.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {emojiOpen && (
        <EmojiPicker
          onPick={insertEmoji}
          onClose={() => {
            setEmojiOpen(false);
            ref.current?.focus();
          }}
        />
      )}

      <div className="flex items-end gap-2">
        {!voiceActive && (
          <button
            type="button"
            data-emoji-toggle
            onClick={() => setEmojiOpen((o) => !o)}
            aria-expanded={emojiOpen}
            aria-haspopup="dialog"
            aria-label={emojiOpen ? "Close emoji" : "Add emoji"}
            className={`btn-ghost btn-icon h-11 w-11 rounded-full ${emojiOpen ? "bg-gold/15 text-ink" : ""}`}
          >
            <Smile aria-hidden className="h-5 w-5" />
          </button>
        )}
        {/* Photo and poll share one 📎 button, so the message box keeps its room on a phone. */}
        {(onPickPhoto || onCreatePoll) && mode?.kind !== "edit" && !voiceActive && (
          <div className="relative order-3">
            <button
              type="button"
              onClick={() => setAttachOpen((o) => !o)}
              aria-expanded={attachOpen}
              aria-haspopup="menu"
              disabled={photoBusy}
              className="btn-ghost btn-icon h-11 w-11 rounded-full"
              aria-label={photoBusy ? "Sending photo…" : "Attach a photo or poll"}
            >
              <Paperclip aria-hidden className={`h-5 w-5 ${photoBusy ? "animate-pulse" : ""}`} />
            </button>
            {attachOpen && (
              <div role="menu" className="absolute bottom-12 right-0 z-30 w-44 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
                {onPickPhoto && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-ink/5"
                    onClick={() => {
                      setAttachOpen(false);
                      photoRef.current?.click();
                    }}
                  >
                    <ImagePlus aria-hidden className="h-4 w-4 text-ink/60" /> {value.trim() ? "Photo (text as caption)" : "Photo"}
                  </button>
                )}
                {onCreatePoll && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-ink/5"
                    onClick={() => {
                      setAttachOpen(false);
                      onCreatePoll();
                    }}
                  >
                    <BarChart3 aria-hidden className="h-4 w-4 text-ink/60" /> Poll
                  </button>
                )}
              </div>
            )}
            {onPickPhoto && (
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onPickPhoto(file);
                }}
              />
            )}
          </div>
        )}
        <label htmlFor="chat-message" className="sr-only">
          {mode?.kind === "edit" ? "Edit message" : "Message"}
        </label>
        <textarea
          hidden={voiceActive}
          ref={ref}
          id="chat-message"
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursor(e.target.selectionStart ?? e.target.value.length);
            setMentionIndex(0);
            if (e.target.value) onTyping?.();
          }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Type a message…"
          autoComplete="off"
          className="input order-2 max-h-40 min-w-0 flex-1 resize-none rounded-2xl"
        />
        <div className={`order-4 ${voiceActive ? "min-w-0 flex-1" : "shrink-0"}`}>
          {showMic && onSendVoice ? (
            <VoiceRecorder onSend={onSendVoice} onActiveChange={setVoiceActive} />
          ) : (
            <button type="submit" disabled={busy || !value.trim()} className="btn-primary btn-icon h-11 w-11 rounded-full" aria-label={mode?.kind === "edit" ? "Save edit" : "Send"}>
              <SendHorizontal aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
