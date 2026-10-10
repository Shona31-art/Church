import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { Hash, Users } from "lucide-react";

export default async function ChatsPage() {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();

  // RLS shows the church-wide channel, your own department's channel (or all
  // of them for pastors/admins), and only the DMs you're part of.
  const [{ data: channels, error }, { data: myDms }] = await Promise.all([
    supabase.from("chat_channels").select("id, name, department_id").eq("church_id", me.church_id).eq("is_dm", false).order("department_id", { nullsFirst: true }),
    supabase.from("chat_channel_members").select("channel_id, chat_channels!inner(is_dm)").eq("user_id", me.id).eq("chat_channels.is_dm", true),
  ]);

  const dmIds = (myDms ?? []).map((m: any) => m.channel_id as string);
  let dmThreads: { channelId: string; otherId: string | null; otherName: string }[] = [];
  if (dmIds.length) {
    const { data: others } = await supabase.from("chat_channel_members").select("channel_id, user_id, app_users(name)").in("channel_id", dmIds).neq("user_id", me.id);
    dmThreads = dmIds.map((id) => {
      const other = others?.find((o: any) => o.channel_id === id) as any;
      return { channelId: id, otherId: other?.user_id ?? null, otherName: other?.app_users?.name ?? "Former member" };
    });
    dmThreads.sort((a, b) => a.otherName.localeCompare(b.otherName));
  }

  const photos = await getAvatarUrls(dmThreads.map((t) => t.otherId).filter((id): id is string => Boolean(id)));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Chats"
        description="Talk with your whole church, your department, or one person privately."
        actions={
          <Link href="/dashboard/chat/dm/new" className="btn-primary">
            New message
          </Link>
        }
      />

      {error && <Alert tone="error">Couldn&apos;t load your chats — refresh the page to try again.</Alert>}

      <Section title="Channels">
        {!channels?.length ? (
          <p className="text-sm text-ink/60">No channels yet. A church-wide channel is created with your church, and each department gets its own.</p>
        ) : (
          <ul className="divide-y divide-line">
            {channels.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/chat/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-ink/[0.02] -mx-2 px-2 rounded-lg">
                  <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-parchment text-ink/55">
                    {c.department_id ? <Users className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                  </span>
                  <span className="font-medium">{c.name}</span>
                  {!c.department_id && (
                    <span className="ml-auto">
                      <StatusBadge tone="neutral">Church-wide</StatusBadge>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Direct messages">
        {!dmThreads.length ? (
          <p className="text-sm text-ink/60">No direct messages yet. Use “New message” to start one.</p>
        ) : (
          <ul className="divide-y divide-line">
            {dmThreads.map((t) => (
              <li key={t.channelId}>
                <Link href={`/dashboard/chat/${t.channelId}`} className="flex items-center gap-3 py-3 hover:bg-ink/[0.02] -mx-2 px-2 rounded-lg">
                  <Avatar name={t.otherName} src={t.otherId ? photos.get(t.otherId) : null} />
                  <span className="font-medium">{t.otherName}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
