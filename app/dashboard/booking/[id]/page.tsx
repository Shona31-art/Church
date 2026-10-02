import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { StatusActions } from "./StatusActions";

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("pastor_booking");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("pastor_bookings")
    .select("*, app_users!pastor_bookings_requested_by_fkey(name), pastor:pastor_id(name)")
    .eq("id", params.id)
    .single();
  if (!booking) notFound();

  const canManage = me && ["pastor", "church_admin"].includes(me.role);

  // Conflict check: other approved bookings for the same pastor on the same
  // date, plus any availability blocks the pastor has set for themselves.
  let conflicts: any[] = [];
  let availabilityBlocked = false;
  if (canManage && booking.pastor_id) {
    const { data: sameDay } = await supabase
      .from("pastor_bookings")
      .select("id, booking_type, preferred_time")
      .eq("pastor_id", booking.pastor_id)
      .eq("preferred_date", booking.preferred_date)
      .eq("status", "approved")
      .neq("id", booking.id);
    conflicts = sameDay || [];

    const { data: block } = await supabase
      .from("pastor_availability_blocks")
      .select("id")
      .eq("pastor_id", booking.pastor_id)
      .eq("blocked_date", booking.preferred_date)
      .maybeSingle();
    availabilityBlocked = Boolean(block);
  }

  return (
    <div className="max-w-md">
      <Link href="/dashboard/booking" className="text-sm text-ink/50 hover:text-ink">← Booking requests</Link>
      <h1 className="text-2xl font-semibold capitalize mt-2 mb-1">{booking.booking_type}</h1>
      <p className="text-sm text-ink/50 mb-6">
        Requested by {booking.app_users?.name} · {new Date(booking.preferred_date).toLocaleDateString()}
        {booking.preferred_time && ` at ${booking.preferred_time}`}
      </p>

      <div className="space-y-2 text-sm mb-6">
        {booking.pastor?.name && <p>Requested pastor: {booking.pastor.name}</p>}
        {booking.location && <p>Location: {booking.location}</p>}
        {booking.details && <p className="text-ink/70">{booking.details}</p>}
        <p>
          Status: <span className="font-medium capitalize">{booking.status}</span>
          {booking.status === "declined" && booking.decline_reason && (
            <span className="text-ink/50"> — {booking.decline_reason}</span>
          )}
        </p>
      </div>

      {canManage && booking.status === "pending" && (conflicts.length > 0 || availabilityBlocked) && (
        <div role="note" className="border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm text-amber-800 mb-4">
          {availabilityBlocked && <p>⚠️ This pastor has marked this date as unavailable.</p>}
          {conflicts.length > 0 && (
            <p>⚠️ {conflicts.length} other approved booking(s) already on this date for this pastor.</p>
          )}
        </div>
      )}

      {canManage && ["pending", "approved"].includes(booking.status) && (
        <StatusActions bookingId={booking.id} status={booking.status} />
      )}
    </div>
  );
}
