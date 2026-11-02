"use client";

import { Ban, Check, CheckCheck, Forward, ImageOff, MicOff, Phone, PhoneMissed, Star, Video } from "lucide-react";
import { formatTime } from "@/lib/format";
import { REACTION_LABELS, messagePreview, parseCallLog, splitMentions, type ChatMessage, type PollVote, type Reaction, type ReactionSummary } from "@/lib/chat";
import { PollCard } from "./PollCard";
import { Avatar } from "@/components/ui/Avatar";
import { MessageMenu } from "./MessageMenu";
import { VoicePlayer } from "./VoicePlayer";
import { ChatImage } from "./ChatImage";
import type { ChatPerson } from "./ChatThread";

/** One message: optional sender header, reply quote, text, time, reactions and menu. */
export function MessageBubble({
  message,
  isMine,
  isDm,
  showHeader,
  sender,
  quoted,
  quotedSenderName,
  reactions,
  myReaction,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onJumpTo,
  receipt,
  starred = false,
  onStar,
  onForward,
  mentionNames = [],
  mentionsMe = false,
  poll,
  onCallBack,
}: {
  message: ChatMessage;
  isMine: boolean;
  isDm: boolean;
  showHeader: boolean;
  sender: ChatPerson;
  quoted?: ChatMessage;
  quotedSenderName?: string;
  reactions: ReactionSummary[];
  myReaction: Reaction | null;
  onReact?: (emoji: Reaction) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onJumpTo: (messageId: string) => void;
  /** Ticks on my own messages in a DM (read receipts). */
  receipt?: "sending" | "sent" | "read";
  starred?: boolean;
  onStar?: () => void;
  onForward?: () => void;
  /** Names of the people @mentioned in this message, to highlight. */
  mentionNames?: string[];
  /** I'm @mentioned here: the bubble gets a gold edge. */
  mentionsMe?: boolean;
  /** For a poll message: its options, live votes and how to vote. */
  /** Call history bubbles: "Tap to call back". */
  onCallBack?: (kind: "voice" | "video") => void;
  poll?: { options: string[]; allowMultiple: boolean; votes: PollVote[]; currentUserId: string; nameOf: (id: string) => string; onVote?: (choices: number[]) => void };
}) {
  const deleted = Boolean(message.deleted_at);
  const callLog = !deleted && message.kind === "text" ? parseCallLog(message.content) : null;
  const removedByModerator = deleted && message.deleted_by && message.deleted_by !== message.sender_id;
  // Group chats show who's talking; in a DM the page header already does.
  const showAvatarColumn = !isMine && !isDm;
  const hasMenu = !message.pending && !deleted && Boolean(onReact || onReply || onEdit || onDelete || onStar || onForward);

  return (
    <div id={`msg-${message.id}`} className={`group flex gap-2 scroll-mt-24 ${isMine ? "justify-end" : "justify-start"} ${showHeader ? "mt-3" : "mt-0.5"}`}>
      {showAvatarColumn && <div className="w-8 shrink-0 pt-0.5">{showHeader && <Avatar name={sender.name} src={sender.photoUrl} size="xs" />}</div>}

      <div className={`flex max-w-[82%] flex-col sm:max-w-[70%] ${isMine ? "items-end" : "items-start"}`}>
        <div className={`flex items-start gap-1 ${isMine ? "flex-row-reverse" : ""}`}>
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm shadow-xs ${
              deleted
                ? "border border-dashed border-line-strong bg-transparent text-ink/60"
                : isMine
                ? `bg-ember text-on-ember ${showHeader ? "rounded-tr-md" : ""}`
                : `border border-line bg-surface ${showHeader ? "rounded-tl-md" : ""}`
            } ${message.pending ? "opacity-70" : ""} ${mentionsMe && !deleted ? "ring-2 ring-gold/70" : ""}`}
          >
            {showHeader && !isMine && !isDm && <p className="mb-0.5 text-xs font-semibold text-gold-deep">{sender.name}</p>}
            {message.forwarded && !deleted && (
              <p className={`mb-0.5 flex items-center gap-1 text-xs italic ${isMine ? "text-on-ember/75" : "text-ink/60"}`}>
                <Forward aria-hidden className="h-3 w-3" /> Forwarded
              </p>
            )}

            {quoted && !deleted && (
              <button
                type="button"
                onClick={() => onJumpTo(quoted.id)}
                className={`mb-1.5 block w-full rounded-lg border-l-[3px] border-gold px-2.5 py-1.5 text-left text-xs ${
                  isMine ? "bg-on-ember/10" : "bg-ink/[0.04]"
                }`}
              >
                <span className="block font-semibold">{quotedSenderName}</span>
                <span className="line-clamp-2 opacity-80">{messagePreview(quoted)}</span>
                <span className="sr-only"> — go to the original message</span>
              </button>
            )}

            {deleted ? (
              <p className="flex items-center gap-1.5 italic">
                <Ban aria-hidden className="h-3.5 w-3.5" />
                {removedByModerator ? "Removed by a moderator" : "This message was deleted"}
              </p>
            ) : message.kind === "image" ? (
              message.media_path && !message.media_expired_at ? (
                <>
                  <ChatImage path={message.media_path} caption={message.content} />
                  {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                </>
              ) : (
                <p className="flex items-center gap-1.5 italic opacity-70">
                  <ImageOff aria-hidden className="h-3.5 w-3.5" />
                  Photo expired
                </p>
              )
            ) : message.kind === "voice" ? (
              message.media_path && !message.media_expired_at ? (
                <VoicePlayer path={message.media_path} durationMs={message.media_duration_ms ?? 0} onDark={isMine} />
              ) : (
                <p className="flex items-center gap-1.5 italic opacity-70">
                  <MicOff aria-hidden className="h-3.5 w-3.5" />
                  Voice note expired
                </p>
              )
            ) : callLog ? (
              // A call in this chat, like WhatsApp's call bubbles.
              <button
                type="button"
                onClick={() => onCallBack?.(callLog.kind)}
                disabled={!onCallBack}
                className="flex min-w-[12rem] items-center gap-3 text-left"
                aria-label={`${callLog.missed ? "Missed " : ""}${callLog.kind} call${callLog.length ? `, ${callLog.length}` : ""}${onCallBack ? ". Tap to call back" : ""}`}
              >
                <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isMine ? "bg-on-ember/15" : "bg-ink/[0.06]"} ${callLog.missed ? "text-red-500" : ""}`}>
                  {callLog.missed ? <PhoneMissed className="h-5 w-5" /> : callLog.kind === "voice" ? <Phone className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </span>
                <span>
                  <span className="block font-semibold">{callLog.missed ? `Missed ${callLog.kind} call` : callLog.kind === "voice" ? "Voice call" : "Video call"}</span>
                  <span className={`block text-xs ${isMine ? "text-on-ember/75" : "text-ink/60"}`}>{callLog.missed ? (onCallBack ? "Tap to call back" : "No answer") : callLog.length}</span>
                </span>
              </button>
            ) : message.kind === "poll" ? (
              poll ? (
                <PollCard question={message.content} options={poll.options} allowMultiple={poll.allowMultiple} votes={poll.votes} currentUserId={poll.currentUserId} nameOf={poll.nameOf} onVote={poll.onVote} onDark={isMine} />
              ) : (
                <p className="whitespace-pre-wrap break-words">📊 {message.content}</p>
              )
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {mentionNames.length
                  ? splitMentions(message.content, mentionNames).map((part, i) =>
                      part.mention ? (
                        <span key={i} className={`font-semibold ${isMine ? "underline" : "text-gold-deep"}`}>
                          {part.text}
                        </span>
                      ) : (
                        <span key={i}>{part.text}</span>
                      )
                    )
                  : message.content}
              </p>
            )}

            <p className={`mt-1 flex items-center justify-end gap-1.5 text-eyebrow tabular ${isMine && !deleted ? "text-on-ember/65" : "text-ink/60"}`}>
              {starred && !deleted && (
                <span title="Starred">
                  <Star aria-hidden className="h-3 w-3 fill-current" />
                  <span className="sr-only">Starred</span>
                </span>
              )}
              {message.edited_at && !deleted && <span>Edited</span>}
              <time dateTime={message.created_at}>{message.pending ? "Sending…" : formatTime(message.created_at)}</time>
              {receipt && receipt !== "sending" && !deleted && (
                <span className={receipt === "read" ? "text-gold-deep" : ""} title={receipt === "read" ? "Read" : "Sent"}>
                  {receipt === "read" ? <CheckCheck aria-hidden className="h-3.5 w-3.5" /> : <Check aria-hidden className="h-3.5 w-3.5" />}
                  <span className="sr-only">{receipt === "read" ? "Read" : "Sent"}</span>
                </span>
              )}
            </p>
          </div>

          {hasMenu && (
            // Always faintly visible (so people find reactions and replies),
            // fully visible on hover/focus, and always on touch screens.
            <div className="opacity-40 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
              <MessageMenu
                align={isMine ? "right" : "left"}
                senderLabel={isMine ? "your message" : `message from ${sender.name}`}
                myReaction={myReaction}
                onReact={onReact}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                starred={starred}
                onStar={onStar}
                onForward={onForward}
              />
            </div>
          )}
        </div>

        {reactions.length > 0 && !deleted && (
          <div className={`-mt-1.5 flex flex-wrap gap-1 px-2 ${isMine ? "justify-end" : ""}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={!onReact}
                onClick={() => onReact?.(r.emoji)}
                aria-pressed={r.mine}
                aria-label={`${REACTION_LABELS[r.emoji]}, ${r.count} ${r.count === 1 ? "person" : "people"}${r.mine ? ", including you" : ""}`}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow-xs ${
                  r.mine ? "border-gold/60 bg-gold/15" : "border-line bg-surface"
                }`}
              >
                <span aria-hidden>{r.emoji}</span>
                {r.count > 1 && <span className="tabular text-ink/70">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
