import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";

export default async function ChatChannelsPage() {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: channels } = await supabase
    .from("chat_channels")
    .select("id, name, department_id")
    .eq("church_id", me!.church_id)
    .eq("is_dm", false)
    .order("department_id", { nullsFirst: true });

  const { data: myDmMemberships } = await supabase
    .from("chat_channel_members")
    .select("channel_id, chat_channels!inner(id, is_dm)")
    .eq("user_id", me!.id)
    .eq("chat_channels.is_dm", true);

  const dmChannelIds = (myDmMemberships || []).map((m: any) => m.channel_id);

  let dmThreads: { channelId: string; otherName: string }[] = [];
  if (dmChannelIds.length) {
    const { data: allMembers } = await supabase
      .from("chat_channel_members")
      .select("channel_id, user_id, app_users(name)")
      .in("channel_id", dmChannelIds);

    dmThreads = dmChannelIds.map((id) => {
      const other = allMembers?.find((m: any) => m.channel_id === id && m.user_id !== me!.id);
      return { channelId: id, otherName: (other as any)?.app_users?.name || "Member" };
    });
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Chats</h1>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-ink/50">Channels</h2>
      </div>
      <div className="space-y-2 mb-8">
        {channels?.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/chat/${c.id}`}
            className="flex items-center gap-3 border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
          >
            <span className="text-lg">{c.department_id ? "🗂️" : "💬"}</span>
            <span className="font-medium">{c.name}</span>
            {!c.department_id && <span className="text-xs text-ink/40 ml-auto">Church-wide</span>}
          </Link>
        ))}
        {!channels?.length && <p className="text-ink/40 text-sm">No channels yet.</p>}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-ink/50">Direct messages</h2>
        <Link href="/dashboard/chat/dm/new" className="text-xs text-ember">
          + New message
        </Link>
      </div>
      <div className="space-y-2">
        {dmThreads.map((t) => (
          <Link
            key={t.channelId}
            href={`/dashboard/chat/${t.channelId}`}
            className="flex items-center gap-3 border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
          >
            <span className="text-lg">👤</span>
            <span className="font-medium">{t.otherName}</span>
          </Link>
        ))}
        {!dmThreads.length && <p className="text-ink/40 text-sm">No direct messages yet.</p>}
      </div>
    </div>
  );
}
