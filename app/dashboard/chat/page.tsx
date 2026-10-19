import Link from "next/link";
import { BellOff, Hash, Lock, Pin, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { getAvatarUrls } from "@/lib/avatars";
import { can } from "@/lib/permissions";
import { isMuted, messagePreview } from "@/lib/chat";
import { formatTime, formatDate } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";

interface ChatRow {
  channelId: string;
  name: string;
  kind: "church" | "department" | "custom" | "dm";
  membersOnly: boolean;
  otherId: string | null;
  pinnedAt: string | null;
  muted: boolean;
  unread: number;
  last: { content: string; kind: "text" | "voice" | "image"; deleted_at: string | null; created_at: string } | null;
}

export default async function ChatsPage() {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();

  // RLS shows the church-wide channel, your own department's channel (or all
  // of them for pastors/admins), and only the DMs you're part of.
  // is_custom / members_only arrive with chat_v3.sql; fall back without them.
  const channelQuery = async () => {
    const full = await supabase.from("chat_channels").select("id, name, department_id, is_custom, members_only").eq("church_id", me.church_id).eq("is_dm", false).order("department_id", { nullsFirst: true });
    if (full.error?.code !== "42703") return full;
    return (await supabase.from("chat_channels").select("id, name, department_id").eq("church_id", me.church_id).eq("is_dm", false).order("department_id", { nullsFirst: true })) as typeof full;
  };
  const [{ data: channels, error }, { data: myDms }, { data: settingsRows }] = await Promise.all([
    channelQuery(),
    supabase.from("chat_channel_members").select("channel_id, chat_channels!inner(is_dm)").eq("user_id", me.id).eq("chat_channels.is_dm", true),
    // Missing table (chat_v2.sql not run) → no settings, no unread counts.
    supabase.from("chat_member_settings").select("*").eq("user_id", me.id),
  ]);
  const settings = new Map((settingsRows ?? []).map((s) => [s.channel_id, s]));

  const dmIds = (myDms ?? []).map((m: any) => m.channel_id as string);
  const { data: others } = dmIds.length
    ? await supabase.from("chat_channel_members").select("channel_id, user_id, app_users(name)").in("channel_id", dmIds).neq("user_id", me.id)
    : { data: [] };

  const base: Omit<ChatRow, "unread" | "last" | "pinnedAt" | "muted">[] = [
    ...(channels ?? []).map((c: any) => ({
      channelId: c.id,
      name: c.name,
      kind: (c.is_custom ? "custom" : c.department_id ? "department" : "church") as ChatRow["kind"],
      membersOnly: Boolean(c.members_only),
      otherId: null,
    })),
    ...dmIds.map((id) => {
      const other = others?.find((o: any) => o.channel_id === id) as any;
      return { channelId: id, name: other?.app_users?.name ?? "Former member", kind: "dm" as const, membersOnly: false, otherId: other?.user_id ?? null };
    }),
  ];

  // Latest message and my unread count per chat. One small query each — a
  // person is in a handful of chats, and both use the (channel, created_at) index.
  const rows: ChatRow[] = await Promise.all(
    base.map(async (row) => {
      const s = settings.get(row.channelId);
      const since = [s?.cleared_at, s?.last_read_at].filter(Boolean).sort().pop();
      let latestQuery = supabase.from("chat_messages").select("content, kind, deleted_at, created_at").eq("channel_id", row.channelId);
      if (s?.cleared_at) latestQuery = latestQuery.gt("created_at", s.cleared_at);
      let unreadQuery = supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("channel_id", row.channelId).neq("sender_id", me.id).is("deleted_at", null);
      if (since) unreadQuery = unreadQuery.gt("created_at", since);
      const [{ data: last }, { count }] = await Promise.all([latestQuery.order("created_at", { ascending: false }).limit(1).maybeSingle(), settingsRows ? unreadQuery : Promise.resolve({ count: 0 })]);
      return { ...row, pinnedAt: s?.pinned_at ?? null, muted: isMuted(s?.muted_until), unread: count ?? 0, last: (last as ChatRow["last"]) ?? null };
    })
  );

  // Pinned first (most recently pinned on top), then most recent activity.
  const order = (a: ChatRow, b: ChatRow) =>
    (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "") || (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? "") || a.name.localeCompare(b.name);
  // "Delete for me" hides a chat until something new arrives after that.
  const visible = rows.filter((r) => {
    const hiddenAt = (settings.get(r.channelId) as any)?.hidden_at as string | undefined;
    return !hiddenAt || (r.last && r.last.created_at > hiddenAt);
  });
  const groupChats = visible.filter((r) => r.kind !== "dm").sort(order);
  const dmChats = visible.filter((r) => r.kind === "dm").sort(order);
  const photos = await getAvatarUrls(dmChats.map((t) => t.otherId).filter((id): id is string => Boolean(id)));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Chats"
        description="Talk with your whole church, your department, or one person privately."
        actions={
          <>
            {can(me.role, "manageChatChannels") && (
              <Link href="/dashboard/chat/channels/new" className="btn-secondary">
                <Plus aria-hidden className="h-4 w-4" /> New channel
              </Link>
            )}
            <Link href="/dashboard/chat/dm/new" className="btn-primary">
              New message
            </Link>
          </>
        }
      />

      {error && <Alert tone="error">Couldn&apos;t load your chats — refresh the page to try again.</Alert>}

      <Section title="Channels">
        {!groupChats.length ? (
          <p className="text-sm text-ink/60">No channels yet. A church-wide channel is created with your church, and each department gets its own.</p>
        ) : (
          <ChatList rows={groupChats} photos={photos} />
        )}
      </Section>

      <Section title="Direct messages">
        {!dmChats.length ? <p className="text-sm text-ink/60">No direct messages yet. Use “New message” to start one.</p> : <ChatList rows={dmChats} photos={photos} />}
      </Section>
    </div>
  );
}

function ChatList({ rows, photos }: { rows: ChatRow[]; photos: Map<string, string> }) {
  const today = formatDate(new Date());
  return (
    <ul className="-mx-2 divide-y divide-line">
      {rows.map((r) => {
        const showCount = r.unread > 0 && !r.muted;
        return (
          <li key={r.channelId}>
            <Link href={`/dashboard/chat/${r.channelId}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-ink/[0.03]">
              {r.kind === "dm" ? (
                <Avatar name={r.name} src={r.otherId ? photos.get(r.otherId) : null} size="md" />
              ) : (
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-parchment text-ink/60">
                  {r.kind === "department" ? <Users className="h-5 w-5" /> : r.membersOnly ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`truncate ${showCount ? "font-semibold" : "font-medium"}`}>{r.name}</span>
                  {r.kind === "church" && <StatusBadge tone="neutral">Church-wide</StatusBadge>}
                  {r.membersOnly && <StatusBadge tone="neutral">Members only</StatusBadge>}
                </div>
                <p className={`truncate text-sm ${showCount ? "text-ink/80" : "text-ink/60"}`}>{r.last ? messagePreview(r.last) : "No messages yet"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {r.last && <span className="tabular text-xs text-ink/60">{formatDate(r.last.created_at) === today ? formatTime(r.last.created_at) : formatDate(r.last.created_at, { weekday: undefined, year: undefined })}</span>}
                <span className="flex items-center gap-1.5">
                  {r.pinnedAt && (
                    <span title="Pinned">
                      <Pin aria-hidden className="h-3.5 w-3.5 text-ink/60" />
                      <span className="sr-only">Pinned</span>
                    </span>
                  )}
                  {r.muted && (
                    <span title="Muted">
                      <BellOff aria-hidden className="h-3.5 w-3.5 text-ink/60" />
                      <span className="sr-only">Muted</span>
                    </span>
                  )}
                  {showCount && (
                    <span className="tabular min-w-[1.25rem] rounded-full bg-ember px-1.5 py-0.5 text-center text-eyebrow font-semibold text-on-ember">
                      {r.unread > 99 ? "99+" : r.unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
