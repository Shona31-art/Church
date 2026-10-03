import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChatThread } from "./ChatThread";

const HISTORY = 200;

export default async function ChatChannelPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();

  // RLS: only channels this person may see (and only DMs they're part of).
  const { data: channel } = await supabase.from("chat_channels").select("id, name, is_dm, department_id").eq("id", params.id).maybeSingle();
  if (!channel) notFound();

  let title = channel.name;
  if (channel.is_dm) {
    const { data: other } = await supabase.from("chat_channel_members").select("app_users(name)").eq("channel_id", params.id).neq("user_id", me.id).maybeSingle();
    title = (other as any)?.app_users?.name ?? "Direct message";
  }

  const [{ data: latest }, { data: members }] = await Promise.all([
    // Newest first, then reversed — so long channels show their latest
    // messages rather than their first 200.
    supabase.from("chat_messages").select("id, channel_id, sender_id, content, created_at, app_users(name)").eq("channel_id", params.id).order("created_at", { ascending: false }).limit(HISTORY),
    supabase.from("app_users").select("id, name").eq("church_id", me.church_id),
  ]);

  const memberNames: Record<string, string> = {};
  members?.forEach((m) => (memberNames[m.id] = m.name));
  const initialMessages = (latest ?? [])
    .reverse()
    .map((m: any) => ({ id: m.id, channel_id: m.channel_id, sender_id: m.sender_id, content: m.content, created_at: m.created_at, sender_name: m.app_users?.name ?? "Former member" }));

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/dashboard/chat", label: "Chats" }}
        title={title}
        description={channel.is_dm ? "Private — only the two of you can read this." : channel.department_id ? "Department channel" : "Everyone in the church can read this channel."}
      />
      <ChatThread
        channelId={channel.id}
        initialMessages={initialMessages}
        truncated={(latest?.length ?? 0) >= HISTORY}
        currentUserId={me.id}
        currentUserName={me.name}
        canModerate={!channel.is_dm && can(me.role, "moderateChat")}
        memberNames={memberNames}
      />
    </div>
  );
}
