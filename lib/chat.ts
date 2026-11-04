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
  kind: "text" | "voice" | "image" | "poll";
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  reply_to_id: string | null;
  media_path: string | null;
  media_duration_ms: number | null;
  media_expired_at: string | null;
  /** chat_v4.sql: forwarded from another chat; people @mentioned; when it disappears. */
  forwarded?: boolean;
  mentions?: string[];
  expires_at?: string | null;
  /** record_members.sql: posted by the church itself (birthday posters) — shown with the church's name and logo. */
  from_church?: boolean;
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
  if (message.kind === "poll") return `Poll: ${message.content}`;
  const text = message.content.replace(/\s+/g, " ").trim();
  return text.length > 90 ? `${text.slice(0, 89)}…` : text;
}

// ---------------------------------------------------------------------------
// Voice notes
// ---------------------------------------------------------------------------

export const CHAT_MEDIA_BUCKET = "chat-media";

/** Longest voice note. The database allows a little slack (125 s) for rounding. */
export const MAX_VOICE_MS = 2 * 60 * 1000;

/** Matches the chat-media bucket's file size limit in chat_v2.sql. */
export const MAX_VOICE_BYTES = 1024 * 1024;

/** Voice notes (and photos) are deleted this long after sending. */
export const MEDIA_RETENTION_DAYS = 90;

/** Files sent before this moment are due for deletion. */
export function mediaExpiryCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - MEDIA_RETENTION_DAYS * 86_400_000);
}

/** 83_000 → "1:23". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The recording format to ask the browser for. MP4/AAC first: it plays on
 * every phone, including older iPhones that can't play WebM. Then WebM/Opus
 * (Chrome, Firefox, Android) and Ogg. Null if the browser can't record.
 */
export function pickRecordingFormat(isSupported: (mime: string) => boolean): { mimeType: string; extension: string } | null {
  const candidates = [
    // AAC named explicitly: some browsers record "audio/mp4" with Opus inside,
    // which older iPhones can't play.
    { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a" },
    { mimeType: "audio/mp4", extension: "m4a" },
    { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    { mimeType: "audio/webm", extension: "webm" },
    { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  ];
  return candidates.find((c) => isSupported(c.mimeType)) ?? null;
}

/** "audio/webm;codecs=opus" → "audio/webm" (Storage checks the plain type). */
export function baseMimeType(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

/** chat-media/<church>/<channel>/<sender>/<random>.<ext> — the folder the Storage policy allows. */
export function chatMediaPath(churchId: string, channelId: string, senderId: string, fileId: string, extension: string): string {
  return `${churchId}/${channelId}/${senderId}/${fileId}.${extension}`;
}

// ---------------------------------------------------------------------------
// Per-chat settings, read receipts, restrictions
// ---------------------------------------------------------------------------

/** Mute choices offered in a chat's menu. "always" is stored as a far-future date. */
export const MUTE_OPTIONS = [
  { value: "8h", label: "8 hours", ms: 8 * 3600_000 },
  { value: "1w", label: "1 week", ms: 7 * 86_400_000 },
  { value: "always", label: "Always", ms: null },
] as const;
export type MuteOption = (typeof MUTE_OPTIONS)[number]["value"];

const ALWAYS = "9999-12-31T00:00:00.000Z";

/** The muted_until value to store for a choice made at `now`. */
export function muteUntil(option: MuteOption, now: Date = new Date()): string {
  const choice = MUTE_OPTIONS.find((o) => o.value === option)!;
  return choice.ms === null ? ALWAYS : new Date(now.getTime() + choice.ms).toISOString();
}

export function isMuted(mutedUntil: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(mutedUntil) && new Date(mutedUntil!).getTime() > now.getTime();
}

/** "Muted until Mon 12:00" / "Muted" (for "always"). */
export function muteLabel(mutedUntil: string): string {
  if (mutedUntil.startsWith("9999")) return "Muted";
  return `Muted until ${new Date(mutedUntil).toLocaleString("en-ZA", { timeZone: APP_TIMEZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

/**
 * Ticks on my own message in a DM: "sent" (✓) until the other person's
 * shared read time reaches it, then "read" (✓✓). No receipt (they've turned
 * receipts off, or I have) stays at "sent" — never a false "read".
 */
export function receiptStatus(message: Pick<ChatMessage, "created_at" | "pending">, otherReadAt: string | null | undefined): "sending" | "sent" | "read" {
  if (message.pending) return "sending";
  if (otherReadAt && new Date(otherReadAt).getTime() >= new Date(message.created_at).getTime()) return "read";
  return "sent";
}

export const RESTRICTION_KINDS = {
  group_mute: "Can't post in group chats",
  no_voice: "Can't send voice notes",
} as const;
export type RestrictionKind = keyof typeof RESTRICTION_KINDS;

export const RESTRICTION_DURATIONS = [
  { value: "1d", label: "24 hours", ms: 86_400_000 },
  { value: "7d", label: "7 days", ms: 7 * 86_400_000 },
  { value: "30d", label: "30 days", ms: 30 * 86_400_000 },
  { value: "lifted", label: "Until lifted", ms: null },
] as const;
export type RestrictionDuration = (typeof RESTRICTION_DURATIONS)[number]["value"];

/** End time for a restriction, or null for "until lifted". */
export function restrictionUntil(duration: RestrictionDuration, now: Date = new Date()): string | null {
  const choice = RESTRICTION_DURATIONS.find((d) => d.value === duration)!;
  return choice.ms === null ? null : new Date(now.getTime() + choice.ms).toISOString();
}

export const DM_PRIVACY_OPTIONS = {
  everyone: "Everyone in my church",
  leaders: "Department leaders, pastors and admins only",
  nobody: "Nobody (pastors and admins can still reach me)",
} as const;
export type DmPrivacy = keyof typeof DM_PRIVACY_OPTIONS;

// Chat photos (behind the chat_photos plan switch).
export const CHAT_PHOTO_MAX_DIMENSION = 1600;

// ---------------------------------------------------------------------------
// Online & last seen (chat_v4.sql)
// ---------------------------------------------------------------------------

/** The app says "I'm here" this often while open; anyone seen within ONLINE_WINDOW_MS shows as online. */
export const PRESENCE_HEARTBEAT_MS = 60_000;
export const ONLINE_WINDOW_MS = 90_000;

/** "online", "last seen today at 14:02", "last seen yesterday at 09:15", "last seen 3 Oct". */
export function lastSeenLabel(lastSeen: string, now: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  const at = new Date(lastSeen);
  if (now.getTime() - at.getTime() < ONLINE_WINDOW_MS) return "online";
  const time = at.toLocaleTimeString("en-ZA", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  const label = dayLabel(lastSeen, now, timeZone);
  if (label === "Today") return `last seen today at ${time}`;
  if (label === "Yesterday") return `last seen yesterday at ${time}`;
  if (/^[A-Z][a-z]+day$/.test(label)) return `last seen ${label} at ${time}`;
  return `last seen ${label}`;
}

// ---------------------------------------------------------------------------
// @mentions (chat_v4.sql)
// ---------------------------------------------------------------------------

/**
 * The people actually mentioned in a message: those picked from the @ list
 * whose "@Name" is still in the text (deleting the text drops the mention).
 */
export function mentionedIds(text: string, picked: Readonly<Record<string, string>>): string[] {
  return Object.entries(picked)
    .filter(([, name]) => text.includes(`@${name}`))
    .map(([id]) => id);
}

/** The "@query" being typed just before the cursor, if any (for the suggestion list). */
export function mentionQuery(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = /(^|\s)@([^\s@]{0,30})$/.exec(before);
  return match ? { query: match[2], start: cursor - match[2].length - 1 } : null;
}

/** Splits text into plain parts and "@Name" mentions of the given names, for highlighting. */
export function splitMentions(text: string, names: readonly string[]): { text: string; mention: boolean }[] {
  const wanted = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!wanted.length) return [{ text, mention: false }];
  const escaped = wanted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts: { text: string; mention: boolean }[] = [];
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mention: false });
    parts.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false });
  return parts;
}

// ---------------------------------------------------------------------------
// Disappearing messages and polls (chat_v4.sql)
// ---------------------------------------------------------------------------

/** Keep in sync with the check on chat_channels.disappear_after_seconds. */
export const DISAPPEAR_OPTIONS = [
  { seconds: 86400, label: "24 hours" },
  { seconds: 604800, label: "7 days" },
  { seconds: 7776000, label: "90 days" },
] as const;

export function disappearLabel(seconds: number | null | undefined): string | null {
  return DISAPPEAR_OPTIONS.find((o) => o.seconds === seconds)?.label ?? null;
}

export const POLL_MAX_OPTIONS = 12;

export interface PollVote {
  message_id: string;
  user_id: string;
  option_index: number;
}

/** Votes per option and who cast them, plus how many different people voted. */
export function tallyPoll(optionCount: number, votes: readonly PollVote[]): { counts: number[]; voters: string[][]; total: number } {
  const counts = Array.from({ length: optionCount }, () => 0);
  const voters: string[][] = Array.from({ length: optionCount }, () => []);
  for (const v of votes) {
    if (v.option_index < 0 || v.option_index >= optionCount) continue;
    counts[v.option_index]++;
    voters[v.option_index].push(v.user_id);
  }
  return { counts, voters, total: new Set(votes.map((v) => v.user_id)).size };
}

// ---------------------------------------------------------------------------
// Call history lines (calls/actions.ts endCall: "📞 Voice call · 2:34",
// "📹 Missed video call"), shown as WhatsApp-style call bubbles.
// ---------------------------------------------------------------------------

export interface CallLog {
  kind: "voice" | "video";
  missed: boolean;
  /** "10 secs", "1 min", "2 mins", "1 hr 5 mins". */
  length: string | null;
}

export function parseCallLog(content: string): CallLog | null {
  const m = /^(📞|📹) (Missed )?(voice|video) call(?: · (\d+(?::\d\d){1,2}))?$/iu.exec(content.trim());
  if (!m) return null;
  return { kind: m[3].toLowerCase() === "voice" ? "voice" : "video", missed: Boolean(m[2]), length: m[4] ? humanCallLength(m[4]) : null };
}

/** "0:10" → "10 secs", "1:05" → "1 min", "12:40" → "12 mins", "1:02:10" → "1 hr 2 mins". */
export function humanCallLength(clock: string): string {
  const parts = clock.split(":").map(Number);
  const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "sec" : "secs"}`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const minText = `${mins} ${mins === 1 ? "min" : "mins"}`;
  return hours ? `${hours} hr${mins ? ` ${minText}` : ""}` : minText;
}
