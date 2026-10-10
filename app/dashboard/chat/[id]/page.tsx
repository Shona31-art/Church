import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { getAvatarUrls } from "@/lib/avatars";
import { planIncludes } from "@/lib/features";
import type { ChatMessage, ChatReaction } from "@/lib/chat";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ChatThread, type ChatPerson } from "./ChatThread";

const HISTORY = 200;

const V2_COLUMNS =
  "id, channel_id, sender_id, content, created_at, kind, edited_at, deleted_at, deleted_by, reply_to_id, media_path, media_duration_ms, media_expired_at";
const V1_COLUMNS = "id, channel_id, sender_id, content, created_at";

export default async function ChatChannelPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();

  // RLS: only channels this person may see (and only DMs they're part of).
  const { data: channel } = await supabase.from("chat_channels").select("id, name, is_dm, department_id").eq("id", params.id).maybeSingle();
  if (!channel) notFound();

  let otherUserId: string | null = null;
  if (channel.is_dm) {
    const { data: other } = await supabase.from("chat_channel_members").select("user_id").eq("channel_id", params.id).neq("user_id", me.id).maybeSingle();
    otherUserId = other?.user_id ?? null;
  }

  // Newest first, then reversed — long channels show their latest messages.
  // If chat_v2.sql hasn't been run, the new columns don't exist (42703): fall
  // back to plain text chat rather than breaking the page.
  const latestQuery = (columns: string) =>
    supabase.from("chat_messages").select(columns).eq("channel_id", params.id).order("created_at", { ascending: false }).limit(HISTORY);
  let v2 = true;
  let { data: latest, error } = await latestQuery(V2_COLUMNS);
  if (error?.code === "42703") {
    v2 = false;
    ({ data: latest, error } = await latestQuery(V1_COLUMNS));
  }
  if (error) console.error("[chat] history failed:", error.message);

  const messages: ChatMessage[] = ((latest ?? []) as any[]).reverse().map((m) => ({
    id: m.id,
    channel_id: m.channel_id,
    sender_id: m.sender_id,
    content: m.content,
    created_at: m.created_at,
    kind: m.kind ?? "text",
    edited_at: m.edited_at ?? null,
    deleted_at: m.deleted_at ?? null,
    deleted_by: m.deleted_by ?? null,
    reply_to_id: m.reply_to_id ?? null,
    media_path: m.media_path ?? null,
    media_duration_ms: m.media_duration_ms ?? null,
    media_expired_at: m.media_expired_at ?? null,
  }));
  const loadedIds = new Set(messages.map((m) => m.id));

  // Replies can quote a message older than the loaded window: fetch those few.
  const missingQuotes = [...new Set(messages.map((m) => m.reply_to_id).filter((id): id is string => Boolean(id) && !loadedIds.has(id!)))];
  const [{ data: quoted }, { data: reactions }, { data: people }] = await Promise.all([
    missingQuotes.length ? supabase.from("chat_messages").select(V2_COLUMNS).in("id", missingQuotes) : Promise.resolve({ data: [] }),
    v2 && messages.length
      ? supabase.from("chat_message_reactions").select("message_id, user_id, emoji").eq("channel_id", params.id).in("message_id", [...loadedIds])
      : Promise.resolve({ data: [] }),
    supabase.from("app_users").select("id, name").eq("church_id", me.church_id),
  ]);

  // Photos for everyone who appears in this conversation.
  const participantIds = [...new Set([me.id, ...messages.map((m) => m.sender_id), ...(otherUserId ? [otherUserId] : [])])];
  const photos = await getAvatarUrls(participantIds);
  const directory: Record<string, ChatPerson> = {};
  for (const p of people ?? []) directory[p.id] = { name: p.name, photoUrl: photos.get(p.id) ?? null };

  const other = otherUserId ? directory[otherUserId] : null;
  const { data: otherAbout } = otherUserId && v2 ? await supabase.from("app_users").select("about").eq("id", otherUserId).maybeSingle() : { data: null };
  const title = channel.is_dm ? other?.name ?? "Former member" : channel.name;

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/dashboard/chat", label: "Chats" }}
        title={
          channel.is_dm ? (
            <span className="flex items-center gap-3">
              <Avatar name={title} src={other?.photoUrl} size="md" />
              {title}
            </span>
          ) : (
            title
          )
        }
        description={
          channel.is_dm
            ? [otherAbout?.about, "Private — only the two of you can read this."].filter(Boolean).join(" · ")
            : channel.department_id
            ? "Department channel"
            : "Everyone in the church can read this channel."
        }
      />
      <ChatThread
        channelId={channel.id}
        churchId={me.church_id!}
        isDm={channel.is_dm}
        v2={v2}
        voiceEnabled={v2 && (await planIncludes("chat_voice"))}
        initialMessages={messages}
        quotedMessages={(quoted ?? []) as unknown as ChatMessage[]}
        initialReactions={(reactions ?? []) as ChatReaction[]}
        truncated={(latest?.length ?? 0) >= HISTORY}
        currentUserId={me.id}
        canModerate={!channel.is_dm && can(me.role, "moderateChat")}
        directory={directory}
      />
    </div>
  );
}
