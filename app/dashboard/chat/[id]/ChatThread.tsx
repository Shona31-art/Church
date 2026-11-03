"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/Toaster";
import { useRouter } from "next/navigation";
import {
  CHAT_MEDIA_BUCKET,
  CHAT_PHOTO_MAX_DIMENSION,
  MAX_MESSAGE_LENGTH,
  MAX_VOICE_BYTES,
  receiptStatus,
  baseMimeType,
  chatMediaPath,
  canDeleteMessage,
  canEditMessage,
  dayKey,
  dayLabel,
  messagePreview,
  startsGroup,
  summarizeReactions,
  mentionedIds,
  type ChatMessage,
  type PollVote,
  type ChatReaction,
  type Reaction,
} from "@/lib/chat";
import { formatDateTime } from "@/lib/format";
import { toCompressedImage } from "@/lib/image-resize";
import { deleteChatMessage, editChatMessage, unblockMember } from "../actions";
import { startChatCall } from "@/app/dashboard/calls/actions";
import { MessageBubble } from "./MessageBubble";
import { ForwardDialog } from "./ForwardDialog";
import { PollDialog } from "./PollDialog";
import { Composer } from "./Composer";
import { CHAT_CLEARED_EVENT } from "./ChatMenu";
import { Copy, Star, Trash2, X } from "lucide-react";
import type { RecordedVoiceNote } from "./VoiceRecorder";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

export interface ChatPerson {
  name: string;
  photoUrl: string | null;
}

const UNKNOWN_PERSON: ChatPerson = { name: "Former member", photoUrl: null };

/**
 * A live conversation. Messages and reactions arrive over Supabase Realtime
 * (needs Realtime enabled — chat_v2.sql adds the tables); without it the
 * thread still works and updates on refresh.
 *
 * `v2` is false until supabase/chat_v2.sql has been run: replies, edits and
 * reactions are hidden, and the thread behaves like the original text chat.
 */
export function ChatThread({
  channelId,
  churchId,
  isDm,
  v2,
  voiceEnabled,
  photosEnabled,
  otherUserId,
  initialOtherReadAt,
  blockedOther,
  groupMute,
  noVoice,
  initialMessages,
  quotedMessages,
  initialReactions,
  truncated,
  currentUserId,
  canModerate,
  directory,
  v4 = false,
  aroundMessage = false,
  focusMessageId = null,
  initialStarred = [],
  initialPolls = {},
  initialVotes = [],
  disappearAfter = null,
  v5 = false,
}: {
  channelId: string;
  churchId: string;
  isDm: boolean;
  v2: boolean;
  /** Voice notes are a plan feature (not on Basic — they use Storage). */
  voiceEnabled: boolean;
  /** Photo sharing: the chat_photos switch, off unless a Super admin enables it. */
  photosEnabled: boolean;
  /** In a DM: the other person (for read ticks and blocking). */
  otherUserId: string | null;
  /** Their shared "read up to" time; null if either of us has receipts off. */
  initialOtherReadAt: string | null;
  /** I've blocked the other person in this DM. */
  blockedOther: boolean;
  /** An active admin restriction on my posting in group chats. */
  groupMute: { until: string | null; reason: string } | null;
  /** An active admin restriction on my voice notes. */
  noVoice: boolean;
  initialMessages: ChatMessage[];
  quotedMessages: ChatMessage[];
  initialReactions: ChatReaction[];
  truncated: boolean;
  currentUserId: string;
  canModerate: boolean;
  directory: Record<string, ChatPerson>;
  /** chat_v4.sql has been run: stars, forwarding, polls, @mentions, disappearing messages. */
  v4?: boolean;
  /** Showing the messages around an older one (opened from search or starred). */
  aroundMessage?: boolean;
  /** Scroll to and highlight this message when the chat opens. */
  focusMessageId?: string | null;
  initialStarred?: string[];
  initialPolls?: Record<string, { options: string[]; allowMultiple: boolean }>;
  initialVotes?: PollVote[];
  /** Disappearing messages: seconds, or null when off. */
  disappearAfter?: number | null;
  /** chat_v5.sql has been run: delete messages just for me. */
  v5?: boolean;
}) {
  // One client for the component's lifetime, so the realtime subscription
  // isn't torn down and rebuilt on every render.
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<ChatReaction[]>(initialReactions);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  // The message(s) being deleted (the confirm dialog is open).
  const [deleting, setDeleting] = useState<ChatMessage[] | null>(null);
  // Choosing several messages (long press, or "Select messages"): their ids.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [otherReadAt, setOtherReadAt] = useState<string | null>(initialOtherReadAt);
  const [typers, setTypers] = useState<Record<string, number>>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(() => new Set(initialStarred));
  const [polls, setPolls] = useState(initialPolls);
  const [votes, setVotes] = useState<PollVote[]>(initialVotes);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  // People picked from the @ list while writing this message (id → name).
  const [picked, setPicked] = useState<Record<string, string>>({});
  const router = useRouter();
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const lastReadRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const person = useCallback((id: string) => directory[id] ?? UNKNOWN_PERSON, [directory]);
  const byId = useMemo(() => new Map([...quotedMessages, ...messages].map((m) => [m.id, m])), [messages, quotedMessages]);

  // Re-evaluate the 15-minute edit window once a minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const focusedRef = useRef(false);
  useEffect(() => {
    // Opened at a particular message (search / starred): go there instead of the bottom, once.
    if (focusMessageId && !focusedRef.current) {
      focusedRef.current = true;
      setTimeout(() => jumpTo(focusMessageId), 150);
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jumpTo is stable enough; only re-run for new messages
  }, [messages.length]);

  // Phones: when the message box gets focus, the keyboard slides up. Once it
  // has, keep the whole thread in view with the newest message showing.
  const threadRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const onComposerFocus = useCallback((e: React.FocusEvent) => {
    if (!(e.target instanceof HTMLTextAreaElement)) return;
    setTimeout(() => {
      threadRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    }, 300);
  }, []);

  useEffect(() => {
    if (deleting) deleteDialogRef.current?.showModal();
    else deleteDialogRef.current?.close();
  }, [deleting]);

  // "Clear my chat history" (⋮ menu): empty the open chat straight away.
  useEffect(() => {
    function onCleared(e: Event) {
      const { channelId: cleared, clearedAt } = (e as CustomEvent<{ channelId: string; clearedAt: string }>).detail;
      if (cleared !== channelId) return;
      setMessages((prev) => prev.filter((m) => m.pending || m.created_at > clearedAt));
      setSelected(null);
      setReplyTo(null);
    }
    window.addEventListener(CHAT_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(CHAT_CLEARED_EVENT, onCleared);
  }, [channelId]);

  // Long press on a message starts choosing several, like WhatsApp.
  const pressRef = useRef<{ timer?: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean }>({ x: 0, y: 0, fired: false });
  function pressStart(e: React.PointerEvent, m: ChatMessage) {
    if (m.pending || (e.pointerType === "mouse" && e.button !== 0)) return;
    clearTimeout(pressRef.current.timer);
    pressRef.current = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: setTimeout(() => {
        pressRef.current.fired = true;
        navigator.vibrate?.(25);
        toggleSelected(m.id, true);
      }, 450),
    };
  }
  function pressMove(e: React.PointerEvent) {
    if (Math.hypot(e.clientX - pressRef.current.x, e.clientY - pressRef.current.y) > 10) clearTimeout(pressRef.current.timer);
  }
  function pressEnd() {
    clearTimeout(pressRef.current.timer);
  }
  /** While choosing, a tap ticks the message instead of doing anything else. */
  function pressClick(e: React.MouseEvent, m: ChatMessage) {
    if (pressRef.current.fired) {
      pressRef.current.fired = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!selected || m.pending) return;
    e.preventDefault();
    e.stopPropagation();
    toggleSelected(m.id);
  }
  function toggleSelected(id: string, on?: boolean) {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (on ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next.size ? next : null;
    });
  }
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !deleting && setSelected(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, deleting]);

  useEffect(() => {
    const toMessage = (row: any): ChatMessage => ({
      id: row.id,
      channel_id: row.channel_id,
      sender_id: row.sender_id,
      content: row.content,
      created_at: row.created_at,
      kind: row.kind ?? "text",
      edited_at: row.edited_at ?? null,
      deleted_at: row.deleted_at ?? null,
      deleted_by: row.deleted_by ?? null,
      reply_to_id: row.reply_to_id ?? null,
      media_path: row.media_path ?? null,
      media_duration_ms: row.media_duration_ms ?? null,
      media_expired_at: row.media_expired_at ?? null,
      forwarded: row.forwarded ?? false,
      mentions: row.mentions ?? [],
      expires_at: row.expires_at ?? null,
    });
    const filter = `channel_id=eq.${channelId}`;

    const channel = supabase
      .channel(`chat:${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter }, ({ new: row }) => {
        const msg = toMessage(row);
        if (msg.kind === "poll") {
          supabase
            .from("chat_polls")
            .select("message_id, options, allow_multiple")
            .eq("message_id", msg.id)
            .maybeSingle()
            .then(({ data }) => data && setPolls((p) => ({ ...p, [data.message_id]: { options: data.options, allowMultiple: data.allow_multiple } })));
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          // Replace my own optimistic copy if the realtime event wins the race.
          const withoutEcho = prev.filter((m) => !(m.pending && m.sender_id === msg.sender_id && m.content === msg.content));
          return [...withoutEcho, msg];
        });
      })
      // Edits and soft deletes arrive as UPDATEs.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter }, ({ new: row }) => {
        const msg = toMessage(row);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      })
      // Hard deletes now only happen when a member is erased (POPIA).
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter }, ({ old }) => {
        setMessages((prev) => prev.filter((m) => m.id !== (old as ChatMessage).id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions", filter }, (payload) => {
        const removed = payload.eventType === "DELETE" ? (payload.old as ChatReaction) : null;
        const added = payload.eventType !== "DELETE" ? (payload.new as ChatReaction) : null;
        setReactions((prev) => {
          const target = removed ?? added!;
          const rest = prev.filter((r) => !(r.message_id === target.message_id && r.user_id === target.user_id));
          return added ? [...rest, added] : rest;
        });
      })
      // Poll votes (chat_v4.sql): live results. A change of vote is a delete
      // then an insert; deletes can't be filtered live, so on any new vote the
      // poll's votes are re-read.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_poll_votes", filter }, ({ new: row }) => {
        const messageId = (row as PollVote).message_id;
        supabase
          .from("chat_poll_votes")
          .select("message_id, user_id, option_index")
          .eq("message_id", messageId)
          .then(({ data }) => data && setVotes((prev) => [...prev.filter((v) => v.message_id !== messageId), ...(data as PollVote[])]));
      })
      // Read receipts: RLS only lets these through if both of us share
      // receipts, so otherwise ticks simply stay at ✓.
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_read_receipts", filter }, (payload) => {
        const row = payload.new as { user_id?: string; read_at?: string };
        if (row?.user_id && row.user_id === otherUserId && row.read_at) setOtherReadAt(row.read_at);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, supabase, otherUserId]);

  // "Typing…" travels as a Realtime broadcast — nothing is stored.
  useEffect(() => {
    if (!v2) return;
    const typing = supabase
      .channel(`typing:${channelId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const userId = (payload as { user_id?: string } | undefined)?.user_id;
        if (userId && userId !== currentUserId) setTypers((t) => ({ ...t, [userId]: Date.now() + 4000 }));
      })
      .subscribe();
    typingChannelRef.current = typing;
    const sweep = setInterval(() => {
      setTypers((t) => {
        const live = Object.fromEntries(Object.entries(t).filter(([, expires]) => expires > Date.now()));
        return Object.keys(live).length === Object.keys(t).length ? t : live;
      });
    }, 1000);
    return () => {
      clearInterval(sweep);
      supabase.removeChannel(typing);
      typingChannelRef.current = null;
    };
  }, [channelId, supabase, currentUserId, v2]);

  function announceTyping() {
    if (Date.now() - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = Date.now();
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { user_id: currentUserId } });
  }

  // Mark the chat read while it's open and visible, and as new messages arrive.
  const lastMessageAt = messages.length ? messages[messages.length - 1].created_at : null;
  useEffect(() => {
    if (!v2) return;
    function markRead() {
      if (document.visibilityState !== "visible" || Date.now() - lastReadRef.current < 2000) return;
      lastReadRef.current = Date.now();
      supabase.rpc("mark_chat_read", { target_channel: channelId }).then(({ error }) => {
        if (error) console.error("[chat] mark read failed:", error.message);
      });
    }
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [channelId, supabase, v2, lastMessageAt]);

  function cancelMode() {
    if (editing) setDraft("");
    setReplyTo(null);
    setEditing(null);
    setSendError(null);
  }

  async function submit() {
    const content = draft.trim();
    if (!content || busy) return;
    if (content.length > MAX_MESSAGE_LENGTH) return setSendError(`Keep messages under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`);
    setSendError(null);

    if (editing) {
      const original = editing;
      setBusy(true);
      setMessages((prev) => prev.map((m) => (m.id === original.id ? { ...m, content, edited_at: new Date().toISOString() } : m)));
      const result = await editChatMessage(original.id, content);
      setBusy(false);
      if (result.error) {
        setMessages((prev) => prev.map((m) => (m.id === original.id ? original : m)));
        setSendError(result.error);
        return;
      }
      setEditing(null);
      setDraft("");
      return;
    }

    const quoting = replyTo;
    const mentions = v4 && !isDm ? mentionedIds(content, picked) : [];
    setBusy(true);
    setDraft("");
    setReplyTo(null);
    setPicked({});
    // Shown immediately; swapped for the real row when the insert (or the
    // realtime event, whichever is first) comes back.
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      channel_id: channelId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      kind: "text",
      edited_at: null,
      deleted_at: null,
      deleted_by: null,
      reply_to_id: quoting?.id ?? null,
      media_path: null,
      media_duration_ms: null,
      media_expired_at: null,
      mentions,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    // Before chat_v2.sql there's no reply_to_id column to write.
    const row: Record<string, unknown> = { channel_id: channelId, sender_id: currentUserId, content };
    if (v2) row.reply_to_id = quoting?.id ?? null;
    if (mentions.length) row.mentions = mentions;
    const { data, error } = await supabase.from("chat_messages").insert(row).select("id, created_at").single();
    setBusy(false);
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      setReplyTo(quoting);
      setSendError(
        /JWT|session/i.test(error?.message ?? "")
          ? "Your session has expired — sign in again. Your message is still in the box."
          : /row-level security/i.test(error?.message ?? "")
          ? "You can't send messages here right now. Your message is still in the box."
          : "Couldn't send — check your connection and try again. Your message is still in the box."
      );
      return;
    }
    setMessages((prev) =>
      prev.some((m) => m.id === data.id)
        ? prev.filter((m) => m.id !== optimistic.id)
        : prev.map((m) => (m.id === optimistic.id ? { ...optimistic, id: data.id, created_at: data.created_at, pending: false } : m))
    );
  }

  /**
   * Voice note: upload to the private chat-media bucket, then post the
   * message. If posting fails the file is removed again, and the recorder
   * keeps the note so it can be retried.
   */
  async function sendVoice(note: RecordedVoiceNote): Promise<string | null> {
    const quoting = replyTo;
    const path = chatMediaPath(churchId, channelId, currentUserId, crypto.randomUUID(), note.extension);
    const { error: uploadError } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(path, note.blob, { contentType: baseMimeType(note.blob.type), upsert: false });
    if (uploadError) {
      console.error("[chat] voice upload failed:", uploadError.message);
      return /jwt|auth/i.test(uploadError.message)
        ? "Your session has expired — sign in again."
        : "Couldn't upload your voice note — check your connection and try again.";
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: channelId,
        sender_id: currentUserId,
        content: "",
        kind: "voice",
        media_path: path,
        media_duration_ms: Math.round(note.durationMs),
        reply_to_id: quoting?.id ?? null,
      })
      .select("id, created_at")
      .single();
    if (error || !data) {
      await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([path]);
      return /row-level security/i.test(error?.message ?? "")
        ? "You can't send voice notes here right now."
        : "Couldn't send your voice note — try again.";
    }

    setReplyTo(null);
    const sent: ChatMessage = {
      id: data.id,
      channel_id: channelId,
      sender_id: currentUserId,
      content: "",
      created_at: data.created_at,
      kind: "voice",
      edited_at: null,
      deleted_at: null,
      deleted_by: null,
      reply_to_id: quoting?.id ?? null,
      media_path: path,
      media_duration_ms: Math.round(note.durationMs),
      media_expired_at: null,
    };
    setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    return null;
  }

  /** Photo: compress in the browser, upload, then post — the typed text becomes its caption. */
  async function sendPhoto(file: File) {
    if (!file.type.startsWith("image/")) return setSendError("Choose a photo (JPG, PNG or WebP).");
    if (file.size > 20 * 1024 * 1024) return setSendError("That photo is over 20 MB — choose a smaller one.");
    const caption = draft.trim().slice(0, 1000);
    const quoting = replyTo;
    setSendError(null);
    setPhotoBusy(true);
    try {
      const { blob, extension } = await toCompressedImage(file, CHAT_PHOTO_MAX_DIMENSION, MAX_VOICE_BYTES);
      const path = chatMediaPath(churchId, channelId, currentUserId, crypto.randomUUID(), extension);
      const { error: uploadError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) {
        console.error("[chat] photo upload failed:", uploadError.message);
        return setSendError("Couldn't upload that photo — check your connection and try again.");
      }
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ channel_id: channelId, sender_id: currentUserId, content: caption, kind: "image", media_path: path, reply_to_id: quoting?.id ?? null })
        .select("id, created_at")
        .single();
      if (error || !data) {
        await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([path]);
        return setSendError(/row-level security/i.test(error?.message ?? "") ? "Photo sharing isn't available here." : "Couldn't send that photo — try again.");
      }
      setDraft("");
      setReplyTo(null);
      const sent: ChatMessage = {
        id: data.id,
        channel_id: channelId,
        sender_id: currentUserId,
        content: caption,
        created_at: data.created_at,
        kind: "image",
        edited_at: null,
        deleted_at: null,
        deleted_by: null,
        reply_to_id: quoting?.id ?? null,
        media_path: path,
        media_duration_ms: null,
        media_expired_at: null,
      };
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    } catch {
      setSendError("We couldn't read that photo. Try a JPG or PNG.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function unblockOther() {
    if (!otherUserId) return;
    const result = await callAction(() => unblockMember(otherUserId), { error: CONNECTION_FAILED });
    if (result.error) return showToast(result.error, "error");
    router.refresh();
  }

  /** Delete for everyone: my own messages (or, for a moderator, one message). */
  async function deleteForEveryone() {
    const targets = deleting ?? [];
    setDeleting(null);
    setSelected(null);
    let failed: string | null = null;
    for (const target of targets) {
      const result = await callAction(() => deleteChatMessage(target.id), { error: CONNECTION_FAILED });
      if (result.error) {
        failed = result.error;
        continue;
      }
      setMessages((prev) => prev.map((m) => (m.id === target.id ? { ...m, content: "", media_path: null, deleted_at: new Date().toISOString(), deleted_by: currentUserId } : m)));
      setReactions((prev) => prev.filter((r) => r.message_id !== target.id));
      if (editing?.id === target.id || replyTo?.id === target.id) cancelMode();
    }
    if (failed) showToast(failed, "error");
  }

  /** Delete for me: gone from my view only; everyone else still sees them. */
  async function deleteForMe() {
    const ids = (deleting ?? []).map((m) => m.id);
    setDeleting(null);
    setSelected(null);
    if (!ids.length) return;
    const previous = messages;
    setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
    if (editing && ids.includes(editing.id)) cancelMode();
    if (replyTo && ids.includes(replyTo.id)) cancelMode();
    const { error } = await supabase
      .from("chat_hidden_messages")
      .upsert(ids.map((message_id) => ({ user_id: currentUserId, message_id, channel_id: channelId })), { onConflict: "user_id,message_id", ignoreDuplicates: true });
    if (error) {
      setMessages(previous);
      showToast("Couldn't delete — check your connection and try again.", "error");
    } else showToast(ids.length === 1 ? "Message deleted for you." : `${ids.length} messages deleted for you.`, "success");
  }

  async function copySelected() {
    const text = messages
      .filter((m) => selected?.has(m.id) && !m.deleted_at && m.content)
      .map((m) => m.content)
      .join("\n");
    setSelected(null);
    if (!text) return showToast("Nothing to copy — those messages have no text.", "info");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied.", "success");
    } catch {
      showToast("Couldn't copy on this device.", "error");
    }
  }

  async function starSelected() {
    const chosen = messages.filter((m) => selected?.has(m.id) && !m.deleted_at && !m.pending);
    setSelected(null);
    const allStarred = chosen.every((m) => starred.has(m.id));
    for (const m of chosen) if (allStarred || !starred.has(m.id)) await toggleStar(m, true);
    if (chosen.length) showToast(allStarred ? "Unstarred." : "Starred. Find them under Chats → Starred.", "success");
  }

  async function react(message: ChatMessage, emoji: Reaction) {
    const mine = reactions.find((r) => r.message_id === message.id && r.user_id === currentUserId);
    const previous = reactions;
    const removing = mine?.emoji === emoji;
    // Optimistic: tapping your current reaction removes it; anything else replaces it.
    setReactions((prev) => [
      ...prev.filter((r) => !(r.message_id === message.id && r.user_id === currentUserId)),
      ...(removing ? [] : [{ message_id: message.id, user_id: currentUserId, emoji }]),
    ]);
    const { error } = removing
      ? await supabase.from("chat_message_reactions").delete().eq("message_id", message.id).eq("user_id", currentUserId)
      : await supabase
          .from("chat_message_reactions")
          .upsert({ message_id: message.id, user_id: currentUserId, channel_id: channelId, emoji }, { onConflict: "message_id,user_id" });
    if (error) {
      setReactions(previous);
      showToast("Couldn't save your reaction — try again.", "error");
    }
  }

  async function toggleStar(message: ChatMessage, quiet = false) {
    const on = !starred.has(message.id);
    setStarred((prev) => {
      const next = new Set(prev);
      if (on) next.add(message.id);
      else next.delete(message.id);
      return next;
    });
    const { error } = on
      ? await supabase.from("chat_starred_messages").insert({ user_id: currentUserId, message_id: message.id, channel_id: channelId })
      : await supabase.from("chat_starred_messages").delete().eq("user_id", currentUserId).eq("message_id", message.id);
    if (error && !/duplicate/i.test(error.message)) {
      setStarred((prev) => {
        const next = new Set(prev);
        if (on) next.delete(message.id);
        else next.add(message.id);
        return next;
      });
      showToast("Couldn't save that — try again.", "error");
    } else if (on && !quiet) showToast("Starred. Find it under Chats → Starred.", "success");
  }

  async function vote(messageId: string, choices: number[]) {
    const previous = votes;
    setVotes((prev) => [...prev.filter((v) => !(v.message_id === messageId && v.user_id === currentUserId)), ...choices.map((option_index) => ({ message_id: messageId, user_id: currentUserId, option_index }))]);
    const { error } = await supabase.rpc("vote_chat_poll", { target_message: messageId, choices });
    if (error) {
      setVotes(previous);
      showToast(error.message.includes("option") ? error.message : "Couldn't save your vote — try again.", "error");
    }
  }

  async function createPoll(question: string, options: string[], multiple: boolean): Promise<string | null> {
    const { data, error } = await supabase.rpc("create_chat_poll", { target_channel: channelId, question, poll_options: options, multiple });
    if (error || !data) return /2 to 12|300|100 characters/.test(error?.message ?? "") ? error!.message : /post/.test(error?.message ?? "") ? "You can't post in this chat right now." : "Couldn't send the poll — try again.";
    const id = data as string;
    setPolls((p) => ({ ...p, [id]: { options, allowMultiple: multiple } }));
    setMessages((prev) =>
      prev.some((m) => m.id === id)
        ? prev
        : [
            ...prev,
            { id, channel_id: channelId, sender_id: currentUserId, content: question, created_at: new Date().toISOString(), kind: "poll", edited_at: null, deleted_at: null, deleted_by: null, reply_to_id: null, media_path: null, media_duration_ms: null, media_expired_at: null },
          ]
    );
    return null;
  }

  /** Tapping a call bubble calls back, straight into the call screen. */
  async function callBack(kind: "voice" | "video") {
    const r = await callAction(() => startChatCall(channelId, kind === "voice"), { error: CONNECTION_FAILED });
    if ("error" in r) return showToast(r.error, "error");
    router.push(`/dashboard/calls/${r.callId}?go=1`);
  }

  function jumpTo(messageId: string) {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return showToast("That message is older than what's shown here.", "info");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate?.([{ backgroundColor: "rgb(var(--gold) / 0.18)" }, { backgroundColor: "transparent" }], { duration: 1400 });
  }

  // What the delete dialog can offer for the chosen messages.
  const deletingAllMine = Boolean(deleting?.length) && deleting!.every((m) => m.sender_id === currentUserId && canDeleteMessage(m, currentUserId, canModerate));
  const deletingAsModerator = deleting?.length === 1 && deleting[0].sender_id !== currentUserId && canDeleteMessage(deleting[0], currentUserId, canModerate);
  const selectedMessages = selected ? messages.filter((m) => selected.has(m.id)) : [];
  // Disappearing messages vanish on time, even while the chat is open.
  const shown = messages.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
  const disappearText = disappearAfter ? { 86400: "24 hours", 604800: "7 days", 7776000: "90 days" }[disappearAfter] : null;

  return (
    <div
      ref={threadRef}
      onFocus={onComposerFocus}
      className="chat-thread card-elevated flex min-h-[26rem] flex-col overflow-hidden rounded-2xl"
    >
      {selected && (
        <div role="toolbar" aria-label="Selected messages" className="flex items-center gap-1 border-b border-line bg-surface px-2 py-1.5">
          <button type="button" className="btn-ghost btn-icon h-10 w-10 rounded-full" onClick={() => setSelected(null)} aria-label="Stop selecting">
            <X aria-hidden className="h-5 w-5" />
          </button>
          <p className="flex-1 text-sm font-semibold" aria-live="polite">
            {selected.size} selected
          </p>
          <button type="button" className="btn-ghost btn-icon h-10 w-10 rounded-full" onClick={copySelected} aria-label="Copy text">
            <Copy aria-hidden className="h-5 w-5" />
          </button>
          {v4 && (
            <button type="button" className="btn-ghost btn-icon h-10 w-10 rounded-full" onClick={starSelected} aria-label="Star">
              <Star aria-hidden className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="btn-ghost btn-icon h-10 w-10 rounded-full text-danger" onClick={() => setDeleting(selectedMessages)} aria-label="Delete">
            <Trash2 aria-hidden className="h-5 w-5" />
          </button>
        </div>
      )}
      <div ref={logRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5" role="log" aria-live="polite" aria-label="Messages">
        {truncated && <p className="mb-2 text-center text-xs text-ink/60">{aroundMessage ? "Showing the messages around the one you opened." : "Showing the most recent messages."}</p>}
        {disappearText && (
          <p className="mx-auto mb-3 w-fit rounded-full border border-line bg-parchment px-3 py-1 text-center text-xs text-ink/70">⏱ Disappearing messages are on: new messages disappear after {disappearText}.</p>
        )}

        {shown.map((m, i) => {
          const previous = shown[i - 1];
          const newDay = !previous || dayKey(previous.created_at) !== dayKey(m.created_at);
          const isMine = m.sender_id === currentUserId;
          const quoted = m.reply_to_id ? byId.get(m.reply_to_id) : undefined;
          const messageReactions = reactions.filter((r) => r.message_id === m.id);
          const myReaction = messageReactions.find((r) => r.user_id === currentUserId)?.emoji ?? null;

          return (
            <div
              key={m.id}
              onPointerDown={(e) => pressStart(e, m)}
              onPointerMove={pressMove}
              onPointerUp={pressEnd}
              onPointerCancel={pressEnd}
              onPointerLeave={pressEnd}
              onClickCapture={(e) => pressClick(e, m)}
              onContextMenu={(e) => {
                // Phones open their own menu on a long press; ours takes over.
                if (selected || pressRef.current.fired || (e.nativeEvent as PointerEvent).pointerType === "touch") e.preventDefault();
              }}
              className={`relative [-webkit-touch-callout:none] ${selected ? "cursor-pointer select-none" : ""}`}
            >
              {selected?.has(m.id) && <div aria-hidden className="pointer-events-none absolute inset-x-[-0.75rem] bottom-0 top-0 rounded-lg bg-gold/15 sm:inset-x-[-1.25rem]" />}
              {newDay && (
                <div className="my-4 flex justify-center" role="separator" aria-label={dayLabel(m.created_at)}>
                  <span className="rounded-full border border-line bg-parchment px-3 py-1 text-eyebrow font-medium text-ink/60">{dayLabel(m.created_at)}</span>
                </div>
              )}
              <MessageBubble
                message={m}
                isMine={isMine}
                isDm={isDm}
                showHeader={newDay || startsGroup(m, previous)}
                sender={person(m.sender_id)}
                quoted={quoted}
                quotedSenderName={quoted ? (quoted.sender_id === currentUserId ? "You" : person(quoted.sender_id).name) : undefined}
                reactions={summarizeReactions(messageReactions, currentUserId)}
                myReaction={myReaction}
                onReact={v2 ? (emoji) => react(m, emoji) : undefined}
                onReply={
                  v2
                    ? () => {
                        setEditing(null);
                        setReplyTo(m);
                      }
                    : undefined
                }
                onEdit={
                  v2 && canEditMessage(m, currentUserId, now)
                    ? () => {
                        setReplyTo(null);
                        setEditing(m);
                        setDraft(m.content);
                      }
                    : undefined
                }
                onDelete={canDeleteMessage(m, currentUserId, canModerate) || (v5 && !m.pending) ? () => setDeleting([m]) : undefined}
                onSelect={v2 && !m.pending ? () => toggleSelected(m.id, true) : undefined}
                onJumpTo={jumpTo}
                receipt={isDm && isMine ? receiptStatus(m, otherReadAt) : undefined}
                starred={starred.has(m.id)}
                onStar={v4 && !m.pending ? () => toggleStar(m) : undefined}
                onForward={v4 && !m.pending && m.kind !== "poll" ? () => setForwarding(m) : undefined}
                mentionNames={(m.mentions ?? []).map((id) => person(id).name)}
                mentionsMe={(m.mentions ?? []).includes(currentUserId)}
                onCallBack={isDm ? callBack : undefined}
                poll={
                  m.kind === "poll" && polls[m.id]
                    ? {
                        options: polls[m.id].options,
                        allowMultiple: polls[m.id].allowMultiple,
                        votes: votes.filter((v) => v.message_id === m.id),
                        currentUserId,
                        nameOf: (id) => person(id).name,
                        onVote: m.deleted_at ? undefined : (choices) => vote(m.id, choices),
                      }
                    : undefined
                }
              />
            </div>
          );
        })}

        {!shown.length && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-display text-lg font-semibold">No messages yet</p>
            <p className="mt-1 text-sm text-ink/60">Say hello — {isDm ? "only the two of you can read this." : "everyone in this channel will see it."}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        busy={busy}
        error={sendError}
        mode={
          editing
            ? { kind: "edit" }
            : replyTo
            ? { kind: "reply", name: replyTo.sender_id === currentUserId ? "yourself" : person(replyTo.sender_id).name, preview: messagePreview(replyTo) }
            : null
        }
        onCancelMode={cancelMode}
        onSendVoice={voiceEnabled && !noVoice ? sendVoice : undefined}
        onPickPhoto={photosEnabled ? sendPhoto : undefined}
        photoBusy={photoBusy}
        onTyping={v2 ? announceTyping : undefined}
        mentionPeople={
          v4 && !isDm
            ? Object.entries(directory)
                .filter(([id]) => id !== currentUserId)
                .map(([id, p]) => ({ id, name: p.name }))
            : undefined
        }
        onMention={(id, name) => setPicked((p) => ({ ...p, [id]: name }))}
        onCreatePoll={v4 ? () => setPollOpen(true) : undefined}
        typingText={typingLine(Object.keys(typers).map((id) => person(id).name), isDm)}
        notice={
          blockedOther ? (
            <>
              You blocked {otherUserId ? person(otherUserId).name : "this person"}.{" "}
              <button type="button" className="link" onClick={unblockOther}>
                Unblock to send messages
              </button>
            </>
          ) : !isDm && groupMute ? (
            <>
              A pastor has paused your posting in group chats{groupMute.until ? ` until ${formatDateTime(groupMute.until)}` : ""}. Reason: {groupMute.reason}
              <span className="mt-1 block text-xs text-ink/60">You can still read this channel and use private messages.</span>
            </>
          ) : null
        }
      />

      {forwarding && <ForwardDialog messageId={forwarding.id} currentChannelId={channelId} onClose={() => setForwarding(null)} />}
      {pollOpen && <PollDialog onCreate={createPoll} onClose={() => setPollOpen(false)} />}

      <dialog
        ref={deleteDialogRef}
        onClose={() => setDeleting(null)}
        aria-labelledby="delete-message-title"
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <h2 id="delete-message-title" className="text-xl font-semibold">
            {deletingAsModerator ? "Remove this message?" : deleting && deleting.length > 1 ? `Delete ${deleting.length} messages?` : "Delete message?"}
          </h2>
          <p className="mt-2 text-sm text-ink/70">
            {deletingAsModerator
              ? `"Remove" shows it as "Removed by a moderator" for everyone and is recorded in the activity log.${v5 ? ' "Delete for me" just hides it from you.' : ""}`
              : deletingAllMine
              ? `"Delete for everyone" shows "This message was deleted" in everyone's chat.${v5 ? ' "Delete for me" hides it from you only.' : ""}`
              : v5
              ? "They'll disappear from your view of this chat. Everyone else still sees them."
              : "Deleting messages just for you needs a database update (chat_v5.sql) — ask your church admin to run it. You can delete your own messages for everyone."}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {/* Cancel first, so a reflexive Enter is safe. */}
            <button type="button" autoFocus className="btn-secondary" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            {v5 && (
              <button type="button" className={deletingAllMine || deletingAsModerator ? "btn-secondary text-danger" : "btn-danger"} onClick={deleteForMe}>
                Delete for me
              </button>
            )}
            {(deletingAllMine || deletingAsModerator) && (
              <button type="button" className="btn-danger" onClick={deleteForEveryone}>
                {deletingAsModerator ? "Remove" : "Delete for everyone"}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}

/** "Alice is typing…", "Alice and Bob are typing…", "Several people are typing…" (just "typing…" in a DM). */
function typingLine(names: string[], isDm: boolean): string | null {
  if (!names.length) return null;
  if (isDm) return "typing…";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}
