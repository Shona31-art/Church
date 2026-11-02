import Link from "next/link";
import { Search } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";

const LIMIT = 60;

/** "abc" → the text around the first match, for the result line. */
function snippet(text: string, q: string): { before: string; match: string; after: string } {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return { before: text.slice(0, 140), match: "", after: "" };
  const start = Math.max(0, i - 50);
  return { before: (start ? "…" : "") + text.slice(start, i), match: text.slice(i, i + q.length), after: text.slice(i + q.length, i + q.length + 80) };
}

/**
 * Search messages, like WhatsApp: across all your chats, or one chat
 * (?chat=). Only messages you can already read are ever found (the same
 * database rules as the chats), not ones you cleared, and not deleted ones.
 */
export default async function ChatSearchPage({ searchParams }: { searchParams: { q?: string; chat?: string } }) {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const chatId = z.string().uuid().safeParse(searchParams.chat).success ? searchParams.chat! : null;

  const { data: chat } = chatId ? await supabase.from("chat_channels").select("id, name, is_dm").eq("id", chatId).maybeSingle() : { data: null };

  let results: { id: string; channel_id: string; sender_id: string; content: string; created_at: string }[] = [];
  let failed = false;
  if (q.length >= 2) {
    // Escape LIKE wildcards so "%" and "_" are searched for literally.
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    let query = supabase.from("chat_messages").select("id, channel_id, sender_id, content, created_at").ilike("content", pattern).is("deleted_at", null).in("kind", ["text", "image", "poll"]);
    if (chat) query = query.eq("channel_id", chat.id);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(LIMIT * 2);
    failed = Boolean(error);
    if (error) console.error("[chat] search failed:", error.message);
    // Leave out what you've cleared or deleted for yourself.
    const { data: settings } = await supabase.from("chat_member_settings").select("channel_id, cleared_at").eq("user_id", me.id);
    const cleared = new Map((settings ?? []).filter((s) => s.cleared_at).map((s) => [s.channel_id, s.cleared_at as string]));
    results = (data ?? []).filter((m) => !cleared.has(m.channel_id) || m.created_at > cleared.get(m.channel_id)!).slice(0, LIMIT);
  }

  // Names: chats (private ones by the other person) and senders.
  const channelIds = [...new Set(results.map((r) => r.channel_id))];
  const senderIds = [...new Set(results.map((r) => r.sender_id))];
  const [{ data: channels }, { data: others }, { data: senders }] = await Promise.all([
    channelIds.length ? supabase.from("chat_channels").select("id, name, is_dm").in("id", channelIds) : Promise.resolve({ data: [] }),
    channelIds.length ? supabase.from("chat_channel_members").select("channel_id, app_users(name)").in("channel_id", channelIds).neq("user_id", me.id) : Promise.resolve({ data: [] }),
    senderIds.length ? supabase.from("app_users").select("id, name").in("id", senderIds) : Promise.resolve({ data: [] }),
  ]);
  const dmName = new Map(((others ?? []) as any[]).map((o) => [o.channel_id, o.app_users?.name ?? "Former member"]));
  const chatName = new Map(((channels ?? []) as any[]).map((c) => [c.id, c.is_dm ? dmName.get(c.id) ?? "Private chat" : c.name]));
  const senderName = new Map(((senders ?? []) as any[]).map((s) => [s.id, s.name]));
  const title = chat ? `Search in ${chat.is_dm ? "this chat" : chat.name}` : "Search messages";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader back={{ href: chat ? `/dashboard/chat/${chat.id}` : "/dashboard/chat", label: chat ? "Back to the chat" : "Chats" }} title={title} />
      <form role="search" className="flex gap-2">
        {chat && <input type="hidden" name="chat" value={chat.id} />}
        <label htmlFor="chat-search" className="sr-only">
          Search for
        </label>
        <input id="chat-search" name="q" type="search" defaultValue={q} placeholder="Search for words in messages" className="input flex-1" autoFocus minLength={2} maxLength={100} />
        <button type="submit" className="btn-primary">
          <Search aria-hidden className="h-4 w-4" /> Search
        </button>
      </form>

      {failed && <Alert tone="error">Search didn&apos;t work just now — please try again.</Alert>}
      {q && q.length < 2 && <p className="text-sm text-ink/60">Type at least two letters.</p>}
      {q.length >= 2 && !failed && !results.length && <p className="text-sm text-ink/60">No messages found for &ldquo;{q}&rdquo;.</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-line" aria-label={`${results.length} results`}>
          {results.map((r) => {
            const s = snippet(r.content, q);
            return (
              <li key={r.id}>
                <Link href={`/dashboard/chat/${r.channel_id}?m=${r.id}`} className="block rounded-xl px-2 py-3 hover:bg-ink/[0.03]">
                  <p className="text-xs text-ink/60">
                    {r.sender_id === me.id ? "You" : senderName.get(r.sender_id) ?? "Former member"}
                    {!chat && <> · {chatName.get(r.channel_id) ?? "Chat"}</>} · {formatDateTime(r.created_at)}
                  </p>
                  <p className="mt-1 text-sm">
                    {s.before}
                    {s.match && <mark className="rounded bg-gold/30 px-0.5 text-ink">{s.match}</mark>}
                    {s.after}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {results.length >= LIMIT && <p className="text-xs text-ink/60">Showing the newest {LIMIT} matches. Add more words to narrow it down.</p>}
    </div>
  );
}
