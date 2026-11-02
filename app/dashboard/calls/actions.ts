"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { todayInAppZone } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { CALL_HOURS, MAX_PARTICIPANTS, bookingCallWindow, isCallOpen, newRoomName } from "@/lib/video-call-rules";

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
  if (!(await checkModuleAccess("video_calls")).allowed) return { error: "Video calls aren't included in your church's plan." };
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

  const { data: existing, error: findError } = await admin.from("video_calls").select("id, room_name, ended_at, expires_at").eq(column, value).is("ended_at", null).maybeSingle();
  if (findError) {
    console.error("[calls] lookup failed:", findError.message);
    return { error: findError.code === "42P01" ? MIGRATION_MISSING : "Couldn't start the call — please try again." };
  }
  if (existing && isCallOpen(existing)) return { callId: existing.id };
  if (existing) await admin.from("video_calls").update({ ended_at: new Date().toISOString() }).eq("id", existing.id);

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
  // with messages). Group chats don't ring: the chat gets a message instead.
  let ring: string[] = [];
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

/** Start (or join) the video call for an approved appointment, on its day. */
export async function startBookingCall(bookingId: string, audioOnly = false): Promise<StartResult> {
  const me = await requireCaller();
  if ("error" in me) return me;
  if (!z.string().uuid().safeParse(bookingId).success) return { error: "That appointment couldn't be found." };

  // RLS: the member who booked it, and the church's pastors and admins.
  const { data: booking } = await createClient().from("pastor_bookings").select("id, church_id, status, preferred_date, requested_by, pastor_id").eq("id", bookingId).maybeSingle();
  if (!booking || booking.church_id !== me.church_id) return { error: "That appointment couldn't be found." };
  if (booking.status !== "approved") return { error: "Video calls open once the appointment is approved." };
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

/** End a call for everyone: whoever started it, or a pastor or church admin. */
export async function endCall(callId: string): Promise<{ ok?: true; error?: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  if (!z.string().uuid().safeParse(callId).success) return { error: "That call couldn't be found." };

  // RLS: only calls this person can see.
  const { data: call } = await createClient().from("video_calls").select("id, room_name, started_by, ended_at").eq("id", callId).maybeSingle();
  if (!call) return { error: "That call couldn't be found." };
  if (call.started_by !== me.id && !can(me.role, "manageBookings")) return { error: "Only the person who started the call, or a pastor, can end it for everyone." };
  if (!call.ended_at) {
    await createAdminClient().from("video_calls").update({ ended_at: new Date().toISOString() }).eq("id", call.id);
    await logAudit({ churchId: me.church_id, actorId: me.id, action: "video_call.ended", targetTable: "video_calls", targetId: call.id });
  }
  return { ok: true };
}
