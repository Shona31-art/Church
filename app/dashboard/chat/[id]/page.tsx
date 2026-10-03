import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { ChatThread } from "./ChatThread";
import { moduleGate } from "@/lib/gate";

export default async function ChatChannelPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: channel } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!channel) notFound();

  let headerName = channel.name;
  if (channel.is_dm) {
    const { data: otherMember } = await supabase
      .from("chat_channel_members")
      .select("app_users(name)")
      .eq("channel_id", params.id)
      .neq("user_id", me!.id)
      .maybeSingle();
    headerName = (otherMember as any)?.app_users?.name || "Direct message";
  }

  const [{ data: messages }, { data: members }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*, app_users(name)")
      .eq("channel_id", params.id)
      .order("created_at")
      .limit(200),
    supabase.from("app_users").select("id, name").eq("church_id", me!.church_id),
  ]);

  const memberNames: Record<string, string> = {};
  members?.forEach((m) => (memberNames[m.id] = m.name));

  const initialMessages = (messages || []).map((m: any) => ({
    ...m,
    sender_name: m.app_users?.name || "Member",
  }));

  const canModerate = me && ["church_admin", "pastor"].includes(me.role) && !channel.is_dm;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-4">
        {channel.is_dm ? "👤" : channel.department_id ? "🗂️" : "💬"} {headerName}
      </h1>
      <ChatThread
        channelId={params.id}
        initialMessages={initialMessages}
        currentUserId={me!.id}
        currentUserName={me!.name}
        canModerate={Boolean(canModerate)}
        memberNames={memberNames}
      />
    </div>
  );
}
