import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { getAvatarUrls } from "@/lib/avatars";
import { planIncludes } from "@/lib/features";
import { isMuted, muteLabel, type ChatMessage, type ChatReaction, type PollVote } from "@/lib/chat";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChatMenu } from "./ChatMenu";
import { BackLink, PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ChatThread, type ChatPerson } from "./ChatThread";
import { DmStatus } from "./DmStatus";
import { videoCallState } from "@/lib/video-calls";
import { StartCallButton } from "@/components/calls/StartCallButton";

const HISTORY = 200;

const V2_COLUMNS =
  "id, channel_id, sender_id, content, created_at, kind, edited_at, deleted_at, deleted_by, reply_to_id, media_path, media_duration_ms, media_expired_at";
const V1_COLUMNS = "id, channel_id, sender_id, content, created_at";
const V4_COLUMNS = `${V2_COLUMNS}, forwarded, mentions, expires_at`;

export default async function ChatChannelPage({ params, searchParams }: { params: { id: string }; searchParams?: { m?: string } }) {
  const gate = await moduleGate("dept_chats");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();

  // RLS: only channels this person may see (and only DMs they're part of).
  // Extra channel details arrive with chat_v3.sql; fall back without them.
  let { data: channel, error: channelError } = await supabase
    .from("chat_channels")
    .select("id, name, is_dm, department_id, is_custom, members_only, description, disappear_after_seconds")
    .eq("id", params.id)
    .maybeSingle();
  if (channelError?.code === "42703") {
    // Before chat_v4.sql (disappearing messages) or chat_v3.sql (channel details).
    ({ data: channel, error: channelError } = (await supabase.from("chat_channels").select("id, name, is_dm, department_id, is_custom, members_only, description").eq("id", params.id).maybeSingle()) as any);
    if (channelError?.code === "42703") ({ data: channel } = (await supabase.from("chat_channels").select("id, name, is_dm, department_id").eq("id", params.id).maybeSingle()) as any);
  }
  if (!channel) notFound();
  const isCustom = Boolean((channel as any).is_custom);
  const membersOnly = Boolean((channel as any).members_only);

  let otherUserId: string | null = null;
  if (channel.is_dm) {
    const { data: other } = await supabase.from("chat_channel_members").select("user_id").eq("channel_id", params.id).neq("user_id", me.id).maybeSingle();
    otherUserId = other?.user_id ?? null;
  }

  // My own settings for this chat (mute / pin / "clear my history").
  // Missing table (chat_v2.sql not run) simply means no settings.
  const { data: settings } = await supabase
    .from("chat_member_settings")
    .select("*")
    .eq("channel_id", params.id)
    .eq("user_id", me.id)
    .maybeSingle();

  // Newest first, then reversed — long channels show their latest messages.
  // If chat_v2.sql hasn't been run, the new columns don't exist (42703): fall
  // back to plain text chat rather than breaking the page.
  const latestQuery = (columns: string) => {
    let query = supabase.from("chat_messages").select(columns).eq("channel_id", params.id);
    if (settings?.cleared_at) query = query.gt("created_at", settings.cleared_at);
    return query.order("created_at", { ascending: false }).limit(HISTORY);
  };
  let v2 = true;
  let v4 = true;
  let { data: latest, error } = await latestQuery(V4_COLUMNS);
  if (error?.code === "42703") {
    v4 = false;
    ({ data: latest, error } = await latestQuery(V2_COLUMNS));
  }
  if (error?.code === "42703") {
    v2 = false;
    ({ data: latest, error } = await latestQuery(V1_COLUMNS));
  }
  if (error) console.error("[chat] history failed:", error.message);

  // Opening a particular message (from search or starred) that's older than
  // the latest page: show the messages around it instead.
  let around = false;
  const focusId = z.string().uuid().safeParse(searchParams?.m).success ? searchParams!.m! : null;
  if (focusId && v2 && !(latest ?? []).some((m: any) => m.id === focusId)) {
    const { data: target } = await supabase.from("chat_messages").select("id, created_at").eq("id", focusId).eq("channel_id", params.id).maybeSingle();
    if (target && (!settings?.cleared_at || target.created_at > settings.cleared_at)) {
      const columns = v4 ? V4_COLUMNS : V2_COLUMNS;
      const [{ data: before }, { data: after }] = await Promise.all([
        supabase.from("chat_messages").select(columns).eq("channel_id", params.id).lt("created_at", target.created_at).order("created_at", { ascending: false }).limit(30),
        supabase.from("chat_messages").select(columns).eq("channel_id", params.id).gte("created_at", target.created_at).order("created_at").limit(HISTORY),
      ]);
      latest = [...((after ?? []) as any[]).reverse(), ...((before ?? []) as any[])] as typeof latest;
      around = true;
    }
  }

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
    forwarded: m.forwarded ?? false,
    mentions: m.mentions ?? [],
    expires_at: m.expires_at ?? null,
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

  // chat_v4.sql: my starred messages here, and the polls (with live votes) on screen.
  const pollIds = messages.filter((m) => m.kind === "poll").map((m) => m.id);
  const [{ data: starredRows }, { data: pollRows }, { data: voteRows }] = v4
    ? await Promise.all([
        supabase.from("chat_starred_messages").select("message_id").eq("channel_id", params.id),
        pollIds.length ? supabase.from("chat_polls").select("message_id, options, allow_multiple").in("message_id", pollIds) : Promise.resolve({ data: [] }),
        pollIds.length ? supabase.from("chat_poll_votes").select("message_id, user_id, option_index").in("message_id", pollIds) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  // Photos for everyone who appears in this conversation.
  const participantIds = [...new Set([me.id, ...messages.map((m) => m.sender_id), ...(otherUserId ? [otherUserId] : [])])];
  const photos = await getAvatarUrls(participantIds);
  const directory: Record<string, ChatPerson> = {};
  for (const p of people ?? []) directory[p.id] = { name: p.name, photoUrl: photos.get(p.id) ?? null };

  const other = otherUserId ? directory[otherUserId] : null;
  const { data: otherAbout } = otherUserId && v2 ? await supabase.from("app_users").select("about").eq("id", otherUserId).maybeSingle() : { data: null };
  const title = channel.is_dm ? other?.name ?? "Former member" : channel.name;

  // Read receipts (RLS returns nothing if either of us has them off), whether
  // I've blocked the other person, my own chat restrictions, plan switches.
  const nowIso = new Date().toISOString();
  const [{ data: receipt }, { data: myBlock }, { data: myRestrictions }, voiceOnPlan, photosOnPlan] = await Promise.all([
    otherUserId && v2
      ? supabase.from("chat_read_receipts").select("read_at").eq("channel_id", params.id).eq("user_id", otherUserId).maybeSingle()
      : Promise.resolve({ data: null }),
    otherUserId && v2
      ? supabase.from("chat_blocks").select("blocked_id").eq("blocker_id", me.id).eq("blocked_id", otherUserId).maybeSingle()
      : Promise.resolve({ data: null }),
    v2
      ? supabase.from("member_chat_restrictions").select("kind, until, reason").eq("user_id", me.id).is("lifted_at", null).or(`until.is.null,until.gt.${nowIso}`)
      : Promise.resolve({ data: [] }),
    v2 ? planIncludes("chat_voice") : Promise.resolve(false),
    v2 ? planIncludes("chat_photos") : Promise.resolve(false),
  ]);
  const groupMute = (myRestrictions ?? []).find((r: any) => r.kind === "group_mute") as { until: string | null; reason: string } | undefined;
  const noVoice = (myRestrictions ?? []).some((r: any) => r.kind === "no_voice");
  const mutedUntil = isMuted(settings?.muted_until) ? settings!.muted_until : null;
  // Video calls (video_calls.sql): not in a private chat with someone you've blocked.
  // chat_v5.sql (delete for me) installed? A missing table answers with an error.
  const v5 = v4 && !(await supabase.from("chat_hidden_messages").select("message_id").limit(1)).error;
  const call = myBlock ? { available: false, activeCallId: null, startedAt: null } : await videoCallState({ channelId: channel.id }, channel.is_dm);

  return (
    <div className="max-w-3xl">
      {/* "‹ Chats" on the left; call buttons and ⋮ on the right of the same row,
          in the page's own flow so they scroll under the phone's top bar. */}
      <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
        <BackLink href="/dashboard/chat" label="Chats" className="" />
        {v2 && (
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Call buttons beside the menu, like WhatsApp. */}
          {call.available && <StartCallButton compact oneToOne={channel.is_dm} place={{ channelId: channel.id }} activeCallId={call.activeCallId} startedAt={call.startedAt} />}
          <ChatMenu
            channelId={channel.id}
            mutedUntil={mutedUntil}
            pinned={Boolean(settings?.pinned_at)}
            dmWith={otherUserId ? { id: otherUserId, name: title, blockedByMe: Boolean(myBlock) } : null}
            channelName={channel.is_dm ? undefined : channel.name}
            canEdit={!channel.is_dm && isCustom && can(me.role, "manageChatChannels")}
            canDelete={!channel.is_dm && (isCustom || Boolean(channel.department_id)) && can(me.role, "deleteChatChannels")}
            v4={v4}
            archived={Boolean((settings as any)?.archived_at)}
            disappearAfter={(channel as any).disappear_after_seconds ?? null}
            canSetDisappearing={channel.is_dm || me.role === "pastor" || me.role === "church_admin"}
          />
        </div>
        )}
      </div>
      <PageHeader
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
            ? <DmStatus channelId={channel.id} fallback={[otherAbout?.about, "Private — only the two of you can read this."].filter(Boolean).join(" · ")} />
            : (channel as any).description
            ? `${(channel as any).description}${membersOnly ? " · Members only" : ""}`
            : membersOnly
            ? "Members only — pastors and admins can also read it."
            : channel.department_id
            ? "Department channel"
            : "Everyone in the church can read this channel."
        }
        meta={
          mutedUntil || settings?.pinned_at ? (
            <>
              {settings?.pinned_at && <StatusBadge tone="neutral">Pinned</StatusBadge>}
              {mutedUntil && <StatusBadge tone="neutral">{muteLabel(mutedUntil)}</StatusBadge>}
            </>
          ) : undefined
        }
      />
      <ChatThread
        channelId={channel.id}
        churchId={me.church_id!}
        isDm={channel.is_dm}
        v2={v2}
        voiceEnabled={voiceOnPlan}
        photosEnabled={photosOnPlan}
        otherUserId={otherUserId}
        initialOtherReadAt={receipt?.read_at ?? null}
        blockedOther={Boolean(myBlock)}
        groupMute={groupMute ?? null}
        noVoice={noVoice}
        initialMessages={messages}
        quotedMessages={(quoted ?? []) as unknown as ChatMessage[]}
        initialReactions={(reactions ?? []) as ChatReaction[]}
        truncated={around || (latest?.length ?? 0) >= HISTORY}
        aroundMessage={around}
        focusMessageId={focusId}
        v4={v4}
        initialStarred={((starredRows ?? []) as { message_id: string }[]).map((r) => r.message_id)}
        initialPolls={Object.fromEntries(((pollRows ?? []) as { message_id: string; options: string[]; allow_multiple: boolean }[]).map((p) => [p.message_id, { options: p.options, allowMultiple: p.allow_multiple }]))}
        initialVotes={(voteRows ?? []) as PollVote[]}
        disappearAfter={(channel as any).disappear_after_seconds ?? null}
        v5={v5}
        currentUserId={me.id}
        canModerate={!channel.is_dm && can(me.role, "moderateChat")}
        directory={directory}
      />
    </div>
  );
}
