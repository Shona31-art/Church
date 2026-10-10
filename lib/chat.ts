// Chat rules shared by the chat screen and its server actions (pure —
// unit-tested in tests/unit/chat.test.ts). The database enforces the same
// rules in supabase/chat_v2.sql; these exist so the screen only offers
// actions that will succeed.

import { APP_TIMEZONE } from "@/lib/format";

export const MAX_MESSAGE_LENGTH = 4000;

/** Keep in sync with edit_chat_message() in supabase/chat_v2.sql. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Keep in sync with the check constraint on chat_message_reactions. */
export const REACTIONS = ["👍", "❤️", "🙏", "😂", "😮", "😢"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const REACTION_LABELS: Record<Reaction, string> = {
  "👍": "thumbs up",
  "❤️": "heart",
  "🙏": "praying hands",
  "😂": "laughing",
  "😮": "surprised",
  "😢": "sad",
};

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  kind: "text" | "voice" | "image";
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  reply_to_id: string | null;
  /** True until the server confirms the insert. */
  pending?: boolean;
}

export interface ChatReaction {
  message_id: string;
  user_id: string;
  emoji: Reaction;
}

/** Can `userId` still edit this message at `now`? */
export function canEditMessage(message: ChatMessage, userId: string, now: number = Date.now()): boolean {
  return (
    message.sender_id === userId &&
    message.kind === "text" &&
    !message.deleted_at &&
    !message.pending &&
    now - new Date(message.created_at).getTime() < EDIT_WINDOW_MS
  );
}

/**
 * Who may delete for everyone: the sender, or a moderator (pastor/admin) in a
 * group channel. `canModerate` is already false in DMs.
 */
export function canDeleteMessage(message: ChatMessage, userId: string, canModerate: boolean): boolean {
  return !message.deleted_at && !message.pending && (message.sender_id === userId || canModerate);
}

export interface ReactionSummary {
  emoji: Reaction;
  count: number;
  mine: boolean;
}

/** Reaction chips under a message, in the fixed order of REACTIONS. */
export function summarizeReactions(reactions: readonly ChatReaction[], userId: string): ReactionSummary[] {
  return REACTIONS.map((emoji) => {
    const matching = reactions.filter((r) => r.emoji === emoji);
    return { emoji, count: matching.length, mine: matching.some((r) => r.user_id === userId) };
  }).filter((r) => r.count > 0);
}

/**
 * Should this message show its sender's name and photo? Not when it directly
 * follows another message from the same person within 5 minutes on the same
 * day — the WhatsApp "bubble group".
 */
export function startsGroup(message: ChatMessage, previous: ChatMessage | undefined): boolean {
  if (!previous || previous.sender_id !== message.sender_id) return true;
  if (dayKey(previous.created_at) !== dayKey(message.created_at)) return true;
  return new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() > 5 * 60 * 1000;
}

/** Calendar day (YYYY-MM-DD) in the church's timezone. */
export function dayKey(iso: string, timeZone: string = APP_TIMEZONE): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

/** "Today", "Yesterday", "Monday" (within a week), else "5 Oct 2026". */
export function dayLabel(iso: string, now: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  const day = dayKey(iso, timeZone);
  const today = dayKey(now.toISOString(), timeZone);
  const daysAgo = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  const date = new Date(`${day}T12:00:00Z`);
  if (daysAgo > 1 && daysAgo < 7) return date.toLocaleDateString("en-ZA", { weekday: "long", timeZone: "UTC" });
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** One-line preview of a message, for reply quotes. */
export function messagePreview(message: Pick<ChatMessage, "content" | "kind" | "deleted_at">): string {
  if (message.deleted_at) return "This message was deleted";
  if (message.kind === "voice") return "Voice note";
  if (message.kind === "image") return message.content ? `Photo · ${message.content}` : "Photo";
  const text = message.content.replace(/\s+/g, " ").trim();
  return text.length > 90 ? `${text.slice(0, 89)}…` : text;
}
