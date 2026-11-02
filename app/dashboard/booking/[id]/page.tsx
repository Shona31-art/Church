import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { BOOKING_TYPE_LABELS, type BookingStatus } from "@/lib/booking";
import { formatDate, formatDateTime, todayInAppZone } from "@/lib/format";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { BookingBadge } from "../BookingBadge";
import { CancelMyRequest, StatusActions } from "./StatusActions";
import { videoCallState } from "@/lib/video-calls";
import { bookingCallWindow } from "@/lib/video-call-rules";
import { StartCallButton } from "@/components/calls/StartCallButton";

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("pastor_booking");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  // RLS: requesters see their own; pastors/admins see the church's.
  const { data: booking } = await supabase
    .from("pastor_bookings")
    .select("*, requester:app_users!pastor_bookings_requested_by_fkey(name, email, phone), pastor:app_users!pastor_bookings_pastor_id_fkey(name)")
    .eq("id", params.id)
    .eq("church_id", me.church_id)
    .maybeSingle();
  if (!booking) notFound();

  const shepherd = can(me.role, "manageBookings");
  const isRequester = booking.requested_by === me.id;
  const status = booking.status as BookingStatus;

  // Conflicts: other approved bookings for the same pastor that day, and any
  // date the pastor has blocked out. A warning only — the pastor decides.
  let conflicts = 0;
  let blocked = false;
  if (shepherd && booking.pastor_id && status === "pending") {
    const [{ count }, { data: block }] = await Promise.all([
      supabase
        .from("pastor_bookings")
        .select("id", { count: "exact", head: true })
        .eq("pastor_id", booking.pastor_id)
        .eq("preferred_date", booking.preferred_date)
        .eq("status", "approved")
        .neq("id", booking.id),
      supabase.from("pastor_availability_blocks").select("id").eq("pastor_id", booking.pastor_id).eq("blocked_date", booking.preferred_date).limit(1).maybeSingle(),
    ]);
    conflicts = count ?? 0;
    blocked = Boolean(block);
  }

  // Video call for an approved appointment (video_calls.sql): on its day.
  const call = status === "approved" ? await videoCallState({ bookingId: booking.id }, true) : { available: false, activeCallId: null, startedAt: null };
  const callWindow = bookingCallWindow(booking.preferred_date, todayInAppZone());

  const typeLabel = BOOKING_TYPE_LABELS[booking.booking_type as keyof typeof BOOKING_TYPE_LABELS] ?? booking.booking_type;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/booking", label: shepherd ? "Booking requests" : "My requests" }}
        title={`${typeLabel} request`}
        meta={<BookingBadge status={status} />}
      />

      {status === "declined" && booking.decline_reason && (
        <Alert tone="error" title="Reason given">
          {booking.decline_reason}
        </Alert>
      )}
      {shepherd && (blocked || conflicts > 0) && (
        <Alert tone="warning" title="Possible clash">
          {blocked && <p>This pastor has marked this date as unavailable.</p>}
          {conflicts > 0 && <p>{conflicts} other approved booking{conflicts === 1 ? " is" : "s are"} already on this date for this pastor.</p>}
        </Alert>
      )}

      {call.available && callWindow !== "past" && (
        <Section title="Video call" description="Meet face to face from wherever you are — only the two of you (and the church's pastors) can join.">
          {callWindow === "open" ? (
            <StartCallButton place={{ bookingId: booking.id }} activeCallId={call.activeCallId} startedAt={call.startedAt} oneToOne />
          ) : (
            <p className="text-sm text-ink/70">A video call button appears here on {formatDate(booking.preferred_date, { weekday: "long" })}, the day of the appointment.</p>
          )}
        </Section>
      )}

      <Section title="Request">
        <DetailList
          items={[
            { label: "Requested by", value: booking.requester?.name ?? "Former member" },
            ...(shepherd
              ? [
                  { label: "Contact", value: [booking.requester?.email, booking.requester?.phone].filter(Boolean).join(" · ") || null },
                ]
              : []),
            { label: "Pastor", value: booking.pastor?.name ?? "Any available pastor" },
            { label: "Preferred date", value: `${formatDate(booking.preferred_date)}${booking.preferred_time ? ` at ${String(booking.preferred_time).slice(0, 5)}` : ""}` },
            { label: "Location", value: booking.location },
            { label: "Submitted", value: formatDateTime(booking.created_at) },
          ]}
        />
        {booking.details && <p className="mt-4 text-sm whitespace-pre-line">{booking.details}</p>}
      </Section>

      {shepherd && ["pending", "approved"].includes(status) && (
        <Section title="Decision">
          <StatusActions bookingId={booking.id} status={status} requesterName={booking.requester?.name ?? "The requester"} />
        </Section>
      )}

      {isRequester && !shepherd && ["pending", "approved"].includes(status) && (
        <Section title="Changed your plans?">
          <CancelMyRequest bookingId={booking.id} />
        </Section>
      )}
    </div>
  );
}
