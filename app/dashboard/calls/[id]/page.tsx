import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { createMeetingToken, isVideoConfigured } from "@/lib/daily";
import { isCallOpen } from "@/lib/video-call-rules";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { CallRoom } from "./CallRoom";

/** A video call. Only people who can see its chat or appointment can open it (RLS). */
export default async function CallPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("video_calls");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;

  const { data: call } = await createClient()
    .from("video_calls")
    .select("id, room_name, room_url, channel_id, booking_id, started_by, expires_at, ended_at, audio_only")
    .eq("id", params.id)
    .maybeSingle();
  if (!call) notFound();

  const back = call.channel_id ? { href: `/dashboard/chat/${call.channel_id}`, label: "Back to the chat" } : { href: `/dashboard/booking/${call.booking_id}`, label: "Back to the appointment" };

  if (!isCallOpen(call) || !isVideoConfigured()) {
    return (
      <div className="max-w-xl space-y-4">
        <PageHeader back={{ href: back.href, label: "Back" }} title="Video call" />
        <Alert tone="info" title="This call has ended">
          Calls end when someone ends them for everyone, or after three hours. You can start a new one from the {call.channel_id ? "chat" : "appointment"}.
        </Alert>
        <Link href={back.href} className="btn-primary">
          {back.label}
        </Link>
      </div>
    );
  }

  // A pass into this room for this person, valid until the call ends.
  let token: string | null = null;
  try {
    token = await createMeetingToken({
      roomName: call.room_name,
      userId: me.id,
      userName: me.name,
      expiresAt: new Date(call.expires_at),
      isOwner: call.started_by === me.id,
    });
  } catch (error) {
    console.error("[calls] meeting token failed:", (error as Error).message);
  }
  if (!token) {
    return (
      <div className="max-w-xl space-y-4">
        <PageHeader back={{ href: back.href, label: "Back" }} title="Video call" />
        <Alert tone="error">The video service didn&apos;t respond. Wait a moment, then refresh this page.</Alert>
      </div>
    );
  }

  return (
    <CallRoom
      callId={call.id}
      src={`${call.room_url}?t=${encodeURIComponent(token)}`}
      back={back}
      canEndForAll={call.started_by === me.id || can(me.role, "manageBookings")}
      audioOnly={Boolean((call as { audio_only?: boolean }).audio_only)}
    />
  );
}
