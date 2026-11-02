import Link from "next/link";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { messagePreview } from "@/lib/chat";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";

/** Your starred messages, newest first (chat_v4.sql). Private to you. */
export default async function StarredMessagesPage() {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();

  // RLS: only your own stars, and only in chats you can still see.
  const { data, error } = await supabase
    .from("chat_starred_messages")
    .select("message_id, channel_id, created_at, chat_messages(content, kind, deleted_at, created_at, sender_id), chat_channels(name, is_dm)")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as any[]).filter((r) => r.chat_messages && !r.chat_messages.deleted_at);
  const dmIds = [...new Set(rows.filter((r) => r.chat_channels?.is_dm).map((r) => r.channel_id as string))];
  const senderIds = [...new Set(rows.map((r) => r.chat_messages.sender_id as string))];
  const [{ data: others }, { data: senders }] = await Promise.all([
    dmIds.length ? supabase.from("chat_channel_members").select("channel_id, app_users(name)").in("channel_id", dmIds).neq("user_id", me.id) : Promise.resolve({ data: [] }),
    senderIds.length ? supabase.from("app_users").select("id, name").in("id", senderIds) : Promise.resolve({ data: [] }),
  ]);
  const dmName = new Map(((others ?? []) as any[]).map((o) => [o.channel_id, o.app_users?.name ?? "Former member"]));
  const senderName = new Map(((senders ?? []) as any[]).map((s) => [s.id, s.name]));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader back={{ href: "/dashboard/chat", label: "Chats" }} title="Starred messages" description="Messages you've starred. Only you can see this list." />
      {error ? (
        <Alert tone={error.code === "42P01" ? "info" : "error"}>
          {error.code === "42P01" ? "Starring messages will be available once your church's database update is installed." : "Couldn't load your starred messages — refresh to try again."}
        </Alert>
      ) : !rows.length ? (
        <p className="text-sm text-ink/60">
          No starred messages yet. Open a message&apos;s menu (⌄) and choose <strong>Star</strong> to keep it here.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const m = r.chat_messages;
            const chat = r.chat_channels?.is_dm ? dmName.get(r.channel_id) ?? "Private chat" : r.chat_channels?.name ?? "Chat";
            return (
              <li key={r.message_id}>
                <Link href={`/dashboard/chat/${r.channel_id}?m=${r.message_id}`} className="block rounded-xl px-2 py-3 hover:bg-ink/[0.03]">
                  <p className="flex items-center gap-1.5 text-xs text-ink/60">
                    <Star aria-hidden className="h-3 w-3 fill-current text-gold" />
                    {m.sender_id === me.id ? "You" : senderName.get(m.sender_id) ?? "Former member"} · {chat} · {formatDateTime(m.created_at)}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm">{messagePreview(m)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
