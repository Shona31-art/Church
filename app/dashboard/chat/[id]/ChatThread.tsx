"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

export function ChatThread({
  channelId,
  initialMessages,
  currentUserId,
  currentUserName,
  canModerate,
  memberNames,
}: {
  channelId: string;
  initialMessages: Message[];
  currentUserId: string;
  currentUserName: string;
  canModerate: boolean;
  memberNames: Record<string, string>;
}) {
  // One client for the component's lifetime. Creating it during render made
  // the realtime effect below re-subscribe on EVERY render (every keystroke
  // in the draft box), dropping messages that arrived in between.
  const [supabase] = useState(() => createClient());
  // Latest names, read inside the long-lived subscription callback without
  // re-subscribing when the parent passes a new object.
  const memberNamesRef = useRef(memberNames);
  memberNamesRef.current = memberNames;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    // Realtime subscription: new messages from anyone in this channel show
    // up live, no refresh needed. Requires Realtime enabled for
    // chat_messages in the Supabase dashboard (see chat_schema.sql note).
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const msg = payload.new as Message;
          msg.sender_name = memberNamesRef.current[msg.sender_id] || "Member";
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, supabase]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;

    setSending(true);
    setDraft("");

    // Optimistic append — the realtime event will also arrive but the
    // duplicate-id check in the subscription above prevents a double entry.
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      channel_id: channelId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      sender_name: currentUserName,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await supabase.from("chat_messages").insert({
      channel_id: channelId,
      sender_id: currentUserId,
      content,
    });

    if (error) {
      // roll back the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
    }

    setSending(false);
  }

  async function deleteMessage(id: string) {
    await supabase.from("chat_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="flex flex-col h-[75vh]">
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`rounded-xl px-3 py-2 text-sm max-w-[75%] ${
                  isMine ? "bg-ember text-white" : "bg-white/70 border border-ink/10"
                }`}
              >
                {!isMine && <p className="text-xs opacity-60 mb-0.5">{m.sender_name}</p>}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {(isMine || canModerate) && !m.id.startsWith("optimistic-") && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    className={`text-xs mt-1 ${isMine ? "text-white/70" : "text-ink/30"}`}
                  >
                    delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!messages.length && (
          <p className="text-ink/40 text-sm text-center mt-8">
            No messages yet — say hello 👋
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border border-ink/20 rounded-lg px-4 py-3"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-ember text-white px-5 py-3 rounded-lg font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
