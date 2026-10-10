import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { ChannelForm } from "../../ChannelForm";
import { loadChannelPeople } from "../../channel-people";

export default async function NewChannelPage() {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "manageChatChannels")) {
    return <PermissionDenied message="Only pastors and church admins can create channels." backHref="/dashboard/chat" />;
  }
  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: "/dashboard/chat", label: "Chats" }} title="New channel" description="A group chat for a team, ministry or interest — open to everyone or just the people you choose." />
      <ChannelForm people={await loadChannelPeople(me.church_id)} />
    </div>
  );
}
