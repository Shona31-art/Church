import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { ChannelForm } from "../../ChannelForm";
import { loadChannelPeople } from "../../channel-people";

export default async function EditChannelPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "manageChatChannels")) {
    return <PermissionDenied message="Only pastors and church admins can change channels." backHref={`/dashboard/chat/${params.id}`} />;
  }

  const supabase = createClient();
  const { data: channel } = await supabase.from("chat_channels").select("id, name, description, members_only, is_custom").eq("id", params.id).maybeSingle();
  if (!channel) notFound();
  if (!channel.is_custom) {
    return <PermissionDenied message="Only channels created in the app can be edited. Department channels follow their department." backHref={`/dashboard/chat/${params.id}`} />;
  }
  const { data: members } = await supabase.from("chat_channel_members").select("user_id").eq("channel_id", params.id);

  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: `/dashboard/chat/${params.id}`, label: channel.name }} title="Edit channel" />
      <ChannelForm
        channel={{ id: channel.id, name: channel.name, description: channel.description, membersOnly: channel.members_only, memberIds: (members ?? []).map((m) => m.user_id) }}
        people={await loadChannelPeople(me.church_id)}
      />
    </div>
  );
}
