"use client";

import { Ban, Check, CheckCheck, ImageOff, MicOff } from "lucide-react";
import { formatTime } from "@/lib/format";
import { REACTION_LABELS, messagePreview, type ChatMessage, type Reaction, type ReactionSummary } from "@/lib/chat";
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
}) {
  const deleted = Boolean(message.deleted_at);
  const removedByModerator = deleted && message.deleted_by && message.deleted_by !== message.sender_id;
  // Group chats show who's talking; in a DM the page header already does.
  const showAvatarColumn = !isMine && !isDm;
  const hasMenu = !message.pending && !deleted && Boolean(onReact || onReply || onEdit || onDelete);

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
            } ${message.pending ? "opacity-70" : ""}`}
          >
            {showHeader && !isMine && !isDm && <p className="mb-0.5 text-xs font-semibold text-gold">{sender.name}</p>}

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
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}

            <p className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] tabular ${isMine && !deleted ? "text-on-ember/65" : "text-ink/60"}`}>
              {message.edited_at && !deleted && <span>Edited</span>}
              <time dateTime={message.created_at}>{message.pending ? "Sending…" : formatTime(message.created_at)}</time>
              {receipt && receipt !== "sending" && !deleted && (
                <span className={receipt === "read" ? "text-gold" : ""} title={receipt === "read" ? "Read" : "Sent"}>
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
