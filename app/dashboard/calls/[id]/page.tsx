import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { callCapacity, iceServersFrom, isCallOpen } from "@/lib/video-call-rules";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { CallRoom } from "./CallRoom";

/** A voice or video call. Only people who can see its chat or appointment can open it (RLS). */
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

  if (!isCallOpen(call)) {
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

  return (
    <CallRoom
      callId={call.id}
      me={{ id: me.id, name: me.name }}
      capacity={callCapacity(call.room_url)}
      iceServers={iceServersFrom({ TURN_URLS: process.env.TURN_URLS, TURN_USERNAME: process.env.TURN_USERNAME, TURN_CREDENTIAL: process.env.TURN_CREDENTIAL })}
      back={back}
      canEndForAll={call.started_by === me.id || can(me.role, "manageBookings")}
      audioOnly={Boolean((call as { audio_only?: boolean }).audio_only)}
      expiresAt={call.expires_at}
    />
  );
}
