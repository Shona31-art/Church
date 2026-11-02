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
import { getAvatarUrls } from "@/lib/avatars";

/** A voice or video call. Only people who can see its chat or appointment can open it (RLS). */
export default async function CallPage({ params, searchParams }: { params: { id: string }; searchParams?: { go?: string } }) {
  const gate = await moduleGate("video_calls");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;

  const { data: call } = await createClient()
    .from("video_calls")
    .select("*")
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

  // Who's on the other end: the other person in a private chat; for an
  // appointment, the member (if I'm the pastor) or the pastor (if I'm the member).
  const supabase = createClient();
  let other: { id: string | null; name: string } | null = null;
  let oneToOne = Boolean(call.booking_id);
  let title = "Group call";
  if (call.channel_id) {
    const { data: channel } = await supabase.from("chat_channels").select("name, is_dm").eq("id", call.channel_id).maybeSingle();
    oneToOne = Boolean(channel?.is_dm);
    title = channel?.name ?? title;
    if (channel?.is_dm) {
      const { data: member } = await supabase.from("chat_channel_members").select("user_id, app_users(name)").eq("channel_id", call.channel_id).neq("user_id", me.id).maybeSingle();
      other = { id: member?.user_id ?? null, name: (member as any)?.app_users?.name ?? "Former member" };
    }
  } else if (call.booking_id) {
    const { data: booking } = await supabase
      .from("pastor_bookings")
      .select("requested_by, pastor_id, requester:app_users!pastor_bookings_requested_by_fkey(name), pastor:app_users!pastor_bookings_pastor_id_fkey(name)")
      .eq("id", call.booking_id)
      .maybeSingle();
    const b = booking as any;
    other = b?.requested_by === me.id ? { id: b?.pastor_id ?? null, name: b?.pastor?.name ?? "Your pastor" } : { id: b?.requested_by ?? null, name: b?.requester?.name ?? "Member" };
  }
  const photo = other?.id ? (await getAvatarUrls([other.id])).get(other.id) ?? null : null;

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
      oneToOne={oneToOne}
      isCaller={call.started_by === me.id}
      other={other ? { name: other.name, photoUrl: photo } : null}
      title={oneToOne ? other?.name ?? "Call" : title}
      autoJoin={searchParams?.go === "1"}
    />
  );
}
