"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { todayInAppZone } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { anyPushConfigured, sendPushToUser } from "@/lib/push";
import { sendCallEnded } from "@/lib/fcm";
import { CALL_HOURS, MAX_PARTICIPANTS, bookingCallWindow, isLiveCall, newRoomName } from "@/lib/video-call-rules";

// Starting, joining and ending calls (supabase/video_calls.sql). Calls are
// built in: phones connect straight to each other (WebRTC — see
// calls/[id]/CallRoom.tsx), introduced over a Supabase Realtime channel only
// the call's participants can join (calls_v2.sql). No outside call service.
// Each action checks the person may use calls (plan) and may be in that chat
// or appointment.

type StartResult = { callId: string } | { error: string };

const MIGRATION_MISSING = "Video calls need a database update first: run supabase/video_calls.sql.";

async function requireCaller(): Promise<AppUser | { error: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  if (!(await checkModuleAccess("video_calls")).allowed) return { error: "Calls aren't included in your church's plan." };
  return me;
}

/**
 * The open call for this chat or appointment, or a new one. A call that has
 * run out is closed first. If two people press "start" at the same moment,
 * one room wins and the other is thrown away.
 */
async function openCall(
  me: AppUser,
  place: { channel_id: string } | { booking_id: string },
  maxParticipants: number,
  ring: string[],
  audioOnly = false
): Promise<StartResult & { created?: boolean }> {
  const admin = createAdminClient();
  const [column, value] = "channel_id" in place ? (["channel_id", place.channel_id] as const) : (["booking_id", place.booking_id] as const);

  const { data: existing, error: findError } = await admin.from("video_calls").select("*").eq(column, value).is("ended_at", null).maybeSingle();
  if (findError) {
    console.error("[calls] lookup failed:", findError.message);
    return { error: findError.code === "42P01" ? MIGRATION_MISSING : "Couldn't start the call — please try again." };
  }
  // Two-person calls: an unanswered or finished call doesn't block a new one.
  const oneToOne = maxParticipants <= MAX_PARTICIPANTS.booking;
  if (existing && isLiveCall(existing, oneToOne)) return { callId: existing.id };
  if (existing) {
    const closing = { ended_at: new Date().toISOString(), ...(existing.connected_at ? {} : { end_reason: "no_answer" }) };
    const { error: closeError } = await admin.from("video_calls").update(closing).eq("id", existing.id);
    if (closeError?.code === "42703") await admin.from("video_calls").update({ ended_at: closing.ended_at }).eq("id", existing.id);
    await admin.from("notifications").update({ read_at: closing.ended_at }).eq("link", `/dashboard/calls/${existing.id}`).eq("type", "video_call").is("read_at", null);
  }

  const expiresAt = new Date(Date.now() + CALL_HOURS * 3600_000);
  // Built-in calls: the "room" is just this call's private channel. The size
  // limit is kept by the call screen (each phone connects to every other).
  const room = { name: newRoomName(), url: `builtin:${maxParticipants}` };

  const { data: created, error } = await admin
    .from("video_calls")
    // ring_user_ids: the database rings these people (a notification each; video_calls.sql).
    .insert({ church_id: me.church_id, ...place, room_name: room.name, room_url: room.url, started_by: me.id, expires_at: expiresAt.toISOString(), ring_user_ids: ring.filter((id) => id !== me.id), audio_only: audioOnly })
    .select("id")
    .single();
  if (error || !created) {
    // Someone else started one a moment ago (one open call per place): join theirs.
    const { data: winner } = await admin.from("video_calls").select("id").eq(column, value).is("ended_at", null).maybeSingle();
    if (winner) return { callId: winner.id };
    console.error("[calls] saving the call failed:", error?.message);
    return { error: "Couldn't start the call — please try again." };
  }
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "video_call.started", targetTable: "video_calls", targetId: created.id, metadata: { [column]: value } });
  return { callId: created.id, created: true };
}

/** Start (or join) the video call in a chat. Anyone who may post in the chat can; a private chat rings the other person. */
export async function startChatCall(channelId: string, audioOnly = false): Promise<StartResult> {
  const me = await requireCaller();
  if ("error" in me) return me;
  if (!z.string().uuid().safeParse(channelId).success) return { error: "That chat couldn't be found." };

  const supabase = createClient();
  // RLS: only chats this person can see. Posting rules (blocks, chat
  // restrictions) decide who may start a call, the same as sending a message.
  const [{ data: channel }, { data: canPost }] = await Promise.all([
    supabase.from("chat_channels").select("id, is_dm, church_id").eq("id", channelId).maybeSingle(),
    supabase.rpc("can_post_chat_message", { target_channel: channelId, message_kind: "text" }),
  ]);
  if (!channel || channel.church_id !== me.church_id) return { error: "That chat couldn't be found." };
  if (canPost === false) return { error: "You can't start a call in this chat right now." };

  // A private chat rings the other person (unless they've blocked you, as
  // with messages). A group rings its members too, like WhatsApp — unless it's
  // a big one (e.g. General), where the chat message is the invitation.
  let ring: string[] = [];
  if (!channel.is_dm) ring = await groupRingList(channelId, me);
  if (channel.is_dm) {
    const { data: other } = await supabase.from("chat_channel_members").select("user_id").eq("channel_id", channelId).neq("user_id", me.id).maybeSingle();
    if (other) {
      const { data: blocked } = await createAdminClient().from("chat_blocks").select("blocker_id").eq("blocker_id", other.user_id).eq("blocked_id", me.id).maybeSingle();
      if (!blocked) ring = [other.user_id];
    }
  }

  const result = await openCall(me, { channel_id: channelId }, channel.is_dm ? MAX_PARTICIPANTS.dm : MAX_PARTICIPANTS.group, ring, audioOnly === true);
  if ("error" in result) return result;

  // Tell a group chat (this also sends the usual message notifications).
  if (result.created && !channel.is_dm) {
    const { error } = await supabase.from("chat_messages").insert({ channel_id: channelId, sender_id: me.id, content: audioOnly === true ? "📞 I started a voice call — tap “Join call” at the top of this chat." : "📹 I started a video call — tap “Join call” at the top of this chat." });
    if (error) console.error("[calls] chat notice failed:", error.message);
  }
  return { callId: result.callId };
}

/** Groups up to this size ring everyone when a call starts. */
const GROUP_RING_LIMIT = 32;

/**
 * Who a group call rings: the people who get the group's message
 * notifications (mirrors chat_notifications_v2.sql) — active members who can
 * read it, haven't muted it and haven't blocked the caller. Nobody if the
 * group is bigger than GROUP_RING_LIMIT.
 */
async function groupRingList(channelId: string, me: AppUser): Promise<string[]> {
  const admin = createAdminClient(); // server only: who's in a group, to ring them
  const { data: ch } = await admin.from("chat_channels").select("id, is_dm, members_only, department_id").eq("id", channelId).maybeSingle();
  if (!ch || ch.is_dm) return [];
  const [{ data: users }, { data: members }, { data: muted }, { data: blockers }] = await Promise.all([
    admin.from("app_users").select("id, role, department_id").eq("church_id", me.church_id!).eq("status", "active").neq("id", me.id).limit(2000),
    (ch as { members_only?: boolean }).members_only ? admin.from("chat_channel_members").select("user_id").eq("channel_id", channelId) : Promise.resolve({ data: [] }),
    admin.from("chat_member_settings").select("user_id").eq("channel_id", channelId).gt("muted_until", new Date().toISOString()),
    admin.from("chat_blocks").select("blocker_id").eq("blocked_id", me.id),
  ]);
  const memberIds = new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id));
  const skip = new Set([...((muted ?? []) as { user_id: string }[]).map((m) => m.user_id), ...((blockers ?? []) as { blocker_id: string }[]).map((b) => b.blocker_id)]);
  const leaders = (role: string) => role === "pastor" || role === "church_admin";
  const audience = ((users ?? []) as { id: string; role: string; department_id: string | null }[]).filter((u) => {
    if (skip.has(u.id)) return false;
    if ((ch as { members_only?: boolean }).members_only) return memberIds.has(u.id) || leaders(u.role);
    return !ch.department_id || u.department_id === ch.department_id || leaders(u.role);
  });
  return audience.length <= GROUP_RING_LIMIT ? audience.map((u) => u.id) : [];
}

/** Start (or join) the video call for an approved appointment, on its day. */
export async function startBookingCall(bookingId: string, audioOnly = false): Promise<StartResult> {
  const me = await requireCaller();
  if ("error" in me) return me;
  if (!z.string().uuid().safeParse(bookingId).success) return { error: "That appointment couldn't be found." };

  // RLS: the member who booked it, and the church's pastors and admins.
  const { data: booking } = await createClient().from("pastor_bookings").select("id, church_id, status, preferred_date, requested_by, pastor_id").eq("id", bookingId).maybeSingle();
  if (!booking || booking.church_id !== me.church_id) return { error: "That appointment couldn't be found." };
  if (booking.status !== "approved") return { error: "Calls open once the appointment is approved." };
  const window = bookingCallWindow(booking.preferred_date, todayInAppZone());
  if (window === "early") return { error: "The video call opens on the day of the appointment." };
  if (window === "past") return { error: "This appointment's date has passed." };

  // Ring the other side: a pastor calling rings the member; the member calling
  // rings the pastor it was booked with (or every pastor and admin, if "any").
  let ring: string[];
  if (booking.requested_by !== me.id) ring = [booking.requested_by];
  else if (booking.pastor_id) ring = [booking.pastor_id];
  else {
    const { data: shepherds } = await createAdminClient().from("app_users").select("id").eq("church_id", me.church_id).in("role", ["pastor", "church_admin"]).neq("status", "disabled");
    ring = (shepherds ?? []).map((s) => s.id);
  }
  return openCall(me, { booking_id: bookingId }, MAX_PARTICIPANTS.booking, ring, audioOnly === true);
}

export type EndReason = "ended" | "declined" | "no_answer";

/** "2:34" or "1:02:10". */
function callLength(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * End a call. Like WhatsApp: in a private chat or an appointment (two
 * people), either person hanging up ends it for both; the person being
 * called can decline; the caller's phone gives up after 45 seconds with no
 * answer. In a group call, only whoever started it — or a pastor — can end it
 * for everyone (others just leave). A private chat then gets a line in its
 * history: "📞 Voice call · 2:34" or "📞 Missed voice call".
 */
export async function endCall(callId: string, reason: EndReason = "ended"): Promise<{ ok?: true; error?: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  if (!z.string().uuid().safeParse(callId).success) return { error: "That call couldn't be found." };
  if (!["ended", "declined", "no_answer"].includes(reason)) return { error: "That didn't look right." };

  const supabase = createClient();
  // RLS: only calls this person can see (they're in that chat or appointment).
  const { data: call } = await supabase.from("video_calls").select("*").eq("id", callId).maybeSingle();
  if (!call) return { error: "That call couldn't be found." };
  if (call.ended_at) return { ok: true };

  // Server lookup: someone added to the call can't see the private chat itself.
  const admin = createAdminClient();
  const { data: channel } = call.channel_id ? await admin.from("chat_channels").select("is_dm").eq("id", call.channel_id).maybeSingle() : { data: null };
  const oneToOne = Boolean(call.booking_id) || Boolean(channel?.is_dm);
  const invited = ((call.invited_user_ids ?? []) as string[]);

  // Someone rung into a group (or added to a call) said no: stop their phone
  // ringing; the call goes on for everyone else.
  if (reason === "declined" && (invited.includes(me.id) || (!oneToOne && ((call.ring_user_ids ?? []) as string[]).includes(me.id)))) {
    await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me.id).eq("link", `/dashboard/calls/${call.id}`).eq("type", "video_call").is("read_at", null);
    await sendCallEnded([me.id], call.id).catch(() => undefined);
    return { ok: true };
  }

  if (!oneToOne && call.started_by !== me.id && !can(me.role, "manageBookings")) {
    return { error: "Only the person who started the call, or a pastor, can end it for everyone." };
  }
  if (reason === "declined" && !((call.ring_user_ids ?? []) as string[]).includes(me.id)) reason = "ended";
  if (reason === "no_answer" && call.started_by !== me.id) reason = "ended";

  const now = new Date();
  let { data: closed, error } = await admin.from("video_calls").update({ ended_at: now.toISOString(), end_reason: reason }).eq("id", call.id).is("ended_at", null).select("id");
  if (error?.code === "42703") ({ data: closed, error } = await admin.from("video_calls").update({ ended_at: now.toISOString() }).eq("id", call.id).is("ended_at", null).select("id"));
  if (error) {
    console.error("[calls] ending the call failed:", error.message);
    return { error: "Couldn't end the call — please try again." };
  }
  if (!closed?.length) return { ok: true }; // someone else ended it a moment ago

  // The ring has stopped mattering: clear it from people's bells.
  await admin.from("notifications").update({ read_at: now.toISOString() }).eq("link", `/dashboard/calls/${call.id}`).eq("type", "video_call").is("read_at", null);
  // …and stop it ringing on Android phones.
  await sendCallEnded([...((call.ring_user_ids ?? []) as string[]), ...invited], call.id).catch(() => undefined);

  // Call history in a private chat, from the caller (also tells the other
  // person about a missed call, through the usual message notification).
  if (channel?.is_dm && call.started_by) {
    const kind = call.audio_only ? "voice" : "video";
    const icon = call.audio_only ? "📞" : "📹";
    const content = call.connected_at
      ? `${icon} ${call.audio_only ? "Voice" : "Video"} call · ${callLength(now.getTime() - new Date(call.connected_at).getTime())}`
      : `${icon} Missed ${kind} call`;
    const { error: logError } = await admin.from("chat_messages").insert({ channel_id: call.channel_id, sender_id: call.started_by, content });
    if (logError) console.error("[calls] call history line failed:", logError.message);
  }
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "video_call.ended", targetTable: "video_calls", targetId: call.id, metadata: { reason } });
  return { ok: true };
}

/** The other person picked up: start the clock for the call length (first time only). */
export async function markCallConnected(callId: string): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !z.string().uuid().safeParse(callId).success) return;
  // RLS: only someone in the call can do this.
  const { data: call } = await createClient().from("video_calls").select("id").eq("id", callId).maybeSingle();
  if (!call) return;
  await createAdminClient().from("video_calls").update({ connected_at: new Date().toISOString() }).eq("id", callId).is("connected_at", null);
}

/**
 * Rings the other phone again (a fresh phone pop-up that buzzes) while the
 * caller is still on "Calling…". The app can't play its own ringtone when
 * it's closed, so repeating the pop-up every few seconds is how a closed
 * phone keeps "ringing". Only the caller, only for an unanswered two-person
 * call in its first minute.
 */
export async function ringAgain(callId: string): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !z.string().uuid().safeParse(callId).success) return;
  const { data: call } = await createClient().from("video_calls").select("*").eq("id", callId).maybeSingle();
  if (!call || call.started_by !== me.id || call.connected_at || !isLiveCall(call, true)) return;
  const targets = ((call.ring_user_ids ?? []) as string[]).filter((id) => id !== me.id);
  if (!targets.length || !anyPushConfigured()) return;
  const link = `/dashboard/calls/${call.id}`;
  await Promise.all(
    targets.map((id) =>
      sendPushToUser(id, "messages", {
        title: me.name,
        body: call.audio_only ? "Incoming voice call" : "Incoming video call",
        link,
        tag: `call:${link}`,
        call: true,
      }).catch(() => 0)
    )
  );
}

// ---------------------------------------------------------------------------
// Adding people to a call (calls_v4.sql)
// ---------------------------------------------------------------------------

/** A private chat or appointment call can grow to this many people. */
const ADDED_CALL_SIZE = MAX_PARTICIPANTS.group;

type CallPerson = { id: string; name: string };

/** The call, if I can see it and it's still open — plus who's already part of it. */
async function openCallForInvites(callId: string) {
  const me = await requireCaller();
  if ("error" in me) return me;
  if (!z.string().uuid().safeParse(callId).success) return { error: "That call couldn't be found." };
  // RLS: only a call I'm part of.
  const { data: call } = await createClient().from("video_calls").select("*").eq("id", callId).maybeSingle();
  if (!call || call.ended_at || new Date(call.expires_at).getTime() <= Date.now()) return { error: "This call has ended." };
  if (!("invited_user_ids" in call)) return { error: "Adding people to calls needs a database update first: run supabase/calls_v4.sql." };
  const admin = createAdminClient();
  // Everyone the call already includes (its chat's members, the appointment's two people, those added).
  const already = new Set<string>([call.started_by, ...((call.ring_user_ids ?? []) as string[]), ...((call.invited_user_ids ?? []) as string[]), me.id].filter(Boolean));
  if (call.channel_id) {
    const { data: members } = await admin.from("chat_channel_members").select("user_id").eq("channel_id", call.channel_id);
    for (const m of members ?? []) already.add(m.user_id);
  }
  // Blocked either way: never offered, never rung.
  const { data: blocks } = await admin.from("chat_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${me.id},blocked_id.eq.${me.id}`);
  const blocked = new Set((blocks ?? []).map((b: { blocker_id: string; blocked_id: string }) => (b.blocker_id === me.id ? b.blocked_id : b.blocker_id)));
  return { me, call, admin, already, blocked };
}

/** People from my church I can add to this call (not already in it, not blocked). */
export async function callInviteCandidates(callId: string): Promise<{ people?: CallPerson[]; error?: string }> {
  const ctx = await openCallForInvites(callId);
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.admin
    .from("app_users")
    .select("id, name")
    .eq("church_id", ctx.me.church_id!)
    .eq("status", "active")
    .order("name")
    .limit(500);
  if (error) {
    console.error("[calls] invite list failed:", error.message);
    return { error: "Couldn't load the church's members — try again." };
  }
  return { people: ((data ?? []) as CallPerson[]).filter((p) => !ctx.already.has(p.id) && !ctx.blocked.has(p.id)) };
}

/** Rings these people into the call (calls_v4.sql's trigger notifies them). */
export async function inviteToCall(callId: string, userIds: string[]): Promise<{ ok?: true; added?: number; error?: string }> {
  const ids = z.array(z.string().uuid()).min(1).max(ADDED_CALL_SIZE).safeParse([...new Set(userIds)]);
  if (!ids.success) return { error: "Choose who to add." };
  const ctx = await openCallForInvites(callId);
  if ("error" in ctx) return { error: ctx.error };
  const { me, call, admin, already, blocked } = ctx;

  // Only active members of my church, not already in the call, not blocked.
  const { data: valid } = await admin.from("app_users").select("id").in("id", ids.data).eq("church_id", me.church_id!).eq("status", "active");
  const adding = ((valid ?? []) as { id: string }[]).map((u) => u.id).filter((id) => !already.has(id) && !blocked.has(id));
  if (!adding.length) return { error: "They're already in this call, or can't be added." };

  const invited = [...((call.invited_user_ids ?? []) as string[]), ...adding];
  // A private chat or appointment call has two people; added people make it a group call.
  const groupCall = Boolean(call.channel_id) && !(await admin.from("chat_channels").select("is_dm").eq("id", call.channel_id).maybeSingle()).data?.is_dm;
  if (!groupCall && 2 + invited.length > ADDED_CALL_SIZE) return { error: `A call can have up to ${ADDED_CALL_SIZE} people.` };

  const { error } = await admin
    .from("video_calls")
    .update({ invited_user_ids: invited, invited_by: me.id, room_url: `builtin:${ADDED_CALL_SIZE}` })
    .eq("id", call.id)
    .is("ended_at", null);
  if (error) {
    console.error("[calls] adding people failed:", error.message);
    return { error: error.code === "42703" ? "Adding people to calls needs a database update first: run supabase/calls_v4.sql." : "Couldn't add them — try again." };
  }
  await logAudit({ churchId: me.church_id!, actorId: me.id, action: "video_call.people_added", targetTable: "video_calls", targetId: call.id, metadata: { added: adding.length } });
  return { ok: true, added: adding.length };
}

// ---------------------------------------------------------------------------
// Who's still in a call (calls_v5.sql)
// ---------------------------------------------------------------------------

/**
 * "I'm in this call" (every 20 s while in it) or "I left". When the last
 * person leaves, the database ends the call. Quietly does nothing before
 * calls_v5.sql has been run.
 */
export async function callPresence(callId: string, here: boolean): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !z.string().uuid().safeParse(callId).success) return;
  // RLS: only a call this person can see.
  const { data: call } = await createClient().from("video_calls").select("id").eq("id", callId).is("ended_at", null).maybeSingle();
  if (!call) return;
  const { error } = await createAdminClient().rpc("call_presence_write", { target: callId, who: me.id, here });
  if (error && error.code !== "PGRST202") console.error("[calls] presence failed:", error.message);
}
