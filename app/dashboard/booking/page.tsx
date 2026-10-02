import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function BookingPage() {
  const access = await checkModuleAccess("pastor_booking");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();
  const isPastorOrAdmin = me && ["pastor", "church_admin"].includes(me.role);

  const query = supabase
    .from("pastor_bookings")
    .select("*, app_users!pastor_bookings_requested_by_fkey(name)")
    .eq("church_id", me!.church_id)
    .order("preferred_date", { ascending: true });

  const { data: bookings, error } = isPastorOrAdmin ? await query : await query.eq("requested_by", me!.id);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          {isPastorOrAdmin ? "Booking requests" : "My requests"}
        </h1>
        <div className="flex gap-2">
          {isPastorOrAdmin && (
            <Link
              href="/dashboard/booking/availability"
              className="border border-ink/20 px-4 py-2 rounded-lg text-sm font-medium"
            >
              My availability
            </Link>
          )}
          <Link
            href="/dashboard/booking/new"
            className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Request booking
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {bookings?.map((b: any) => (
          <Link
            key={b.id}
            href={`/dashboard/booking/${b.id}`}
            className="flex items-center justify-between border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
          >
            <div>
              <p className="font-semibold capitalize">{b.booking_type}</p>
              <p className="text-sm text-ink/50">
                {new Date(b.preferred_date).toLocaleDateString()}
                {b.preferred_time && ` at ${b.preferred_time}`}
                {isPastorOrAdmin && ` · requested by ${b.app_users?.name}`}
              </p>
            </div>
            <StatusBadge status={b.status} />
          </Link>
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-700">⚠ Couldn't load booking requests — refresh the page to try again.</p>
        )}
        {!error && !bookings?.length && (
          <p className="text-ink/40 text-sm">
            {isPastorOrAdmin ? "No booking requests yet." : "You haven't requested a booking yet — use “Request booking” to ask a pastor for a wedding, baptism, counselling and more."}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "text-green-700"
      : status === "declined"
      ? "text-red-700"
      : status === "completed"
      ? "text-ink/40"
      : "text-amber-700";
  return <span className={`text-xs ${color}`}>{status}</span>;
}
