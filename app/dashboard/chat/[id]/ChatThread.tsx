"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/Toaster";
import { formatDateTime } from "@/lib/format";

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

const MAX_LENGTH = 4000;

export function ChatThread({
  channelId,
  initialMessages,
  truncated,
  currentUserId,
  currentUserName,
  canModerate,
  memberNames,
}: {
  channelId: string;
  initialMessages: Message[];
  truncated: boolean;
  currentUserId: string;
  currentUserName: string;
  canModerate: boolean;
  memberNames: Record<string, string>;
}) {
  // One client for the component's lifetime. Creating it during render made
  // the realtime effect re-subscribe on every keystroke, dropping messages.
  const [supabase] = useState(() => createClient());
  // Latest names, read inside the long-lived subscription without
  // re-subscribing when the parent passes a new object.
  const memberNamesRef = useRef(memberNames);
  memberNamesRef.current = memberNames;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  useEffect(() => {
    // Live updates. Needs Realtime enabled for chat_messages (README); without
    // it the thread still works, it just updates on refresh.
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        const msg = payload.new as Message;
        msg.sender_name = memberNamesRef.current[msg.sender_id] || "Member";
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev.filter((m) => !(m.id.startsWith("optimistic-") && m.content === msg.content && m.sender_id === msg.sender_id)), msg]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, supabase]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    if (content.length > MAX_LENGTH) {
      setSendError(`Keep messages under ${MAX_LENGTH.toLocaleString()} characters.`);
      return;
    }

    setSending(true);
    setSendError(null);
    setDraft("");
    // Shown immediately; replaced by the real row (from the insert or the
    // realtime event, whichever arrives first).
    const optimistic: Message = { id: `optimistic-${Date.now()}`, channel_id: channelId, sender_id: currentUserId, content, created_at: new Date().toISOString(), sender_name: currentUserName };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from("chat_messages").insert({ channel_id: channelId, sender_id: currentUserId, content }).select("id, created_at").single();
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      setSendError(/JWT|session/i.test(error?.message ?? "") ? "Your session has expired — sign in again. Your message is still in the box." : "Couldn't send — check your connection and try again. Your message is still in the box.");
    } else {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev.filter((m) => m.id !== optimistic.id) : prev.map((m) => (m.id === optimistic.id ? { ...optimistic, id: data.id, created_at: data.created_at } : m))));
    }
    setSending(false);
  }

  async function deleteMessage(id: string) {
    setConfirmingDelete(null);
    const { error, count } = await supabase.from("chat_messages").delete({ count: "exact" }).eq("id", id);
    if (error || !count) {
      showToast("Couldn't delete that message — you may not have permission.", "error");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    showToast("Message deleted.");
  }

  return (
    <div className="card-elevated rounded-2xl flex flex-col h-[calc(100dvh-14rem)] min-h-[24rem]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite" aria-label="Messages">
        {truncated && <p className="text-center text-xs text-ink/50">Showing the most recent messages.</p>}
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          const canDelete = (isMine || canModerate) && !m.id.startsWith("optimistic-");
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`rounded-2xl px-3.5 py-2 text-sm max-w-[80%] ${isMine ? "bg-ember text-on-ember" : "bg-parchment border border-line"}`}>
                {!isMine && <p className="text-xs font-semibold opacity-70 mb-0.5">{m.sender_name}</p>}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div className={`mt-1 flex items-center gap-3 text-[11px] ${isMine ? "text-on-ember/70" : "text-ink/50"}`}>
                  <time dateTime={m.created_at}>{m.id.startsWith("optimistic-") ? "Sending…" : formatDateTime(m.created_at, { weekday: undefined })}</time>
                  {canDelete &&
                    (confirmingDelete === m.id ? (
                      <span className="flex gap-2">
                        <button type="button" onClick={() => deleteMessage(m.id)} className="font-semibold underline">
                          Delete message
                        </button>
                        <button type="button" onClick={() => setConfirmingDelete(null)} className="underline">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmingDelete(m.id)} className="underline-offset-2 hover:underline">
                        Delete<span className="sr-only"> message from {m.sender_name ?? "you"}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
        {!messages.length && <p className="text-ink/60 text-sm text-center mt-8">No messages yet — say hello 👋</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t border-line p-3">
        {sendError && (
          <p role="alert" className="text-xs text-danger mb-2">
            {sendError}
          </p>
        )}
        <div className="flex gap-2">
          <label htmlFor="chat-message" className="sr-only">
            Message
          </label>
          <input
            id="chat-message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_LENGTH}
            placeholder="Type a message…"
            autoComplete="off"
            className="input flex-1"
          />
          <button type="submit" disabled={sending || !draft.trim()} className="btn-primary">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
