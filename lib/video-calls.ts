import "server-only";
import { createClient } from "@/lib/supabase/server";
import { planIncludes } from "@/lib/features";
import { isLiveCall } from "@/lib/video-call-rules";

/**
 * For a chat or appointment page: should the video call button show, and is
 * a call already running there (so the button says "Join call")? Hidden when
 * Daily isn't set up, the plan doesn't include calls, or video_calls.sql
 * hasn't been run yet.
 */
export async function videoCallState(place: { channelId: string } | { bookingId: string }, oneToOne = false): Promise<{ available: boolean; activeCallId: string | null; startedAt: string | null }> {
  if (!(await planIncludes("video_calls"))) return { available: false, activeCallId: null, startedAt: null };
  const [column, value] = "channelId" in place ? ["channel_id", place.channelId] : ["booking_id", place.bookingId];
  const { data, error } = await createClient().from("video_calls").select("*").eq(column, value).is("ended_at", null).maybeSingle();
  if (error) return { available: false, activeCallId: null, startedAt: null };
  const live = data && isLiveCall(data, oneToOne);
  return { available: true, activeCallId: live ? data.id : null, startedAt: live && !data.connected_at && oneToOne ? data.started_at : null };
}

