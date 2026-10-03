import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { BOOKING_TYPE_LABELS, type BookingStatus } from "@/lib/booking";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { BookingBadge } from "./BookingBadge";

const SHEPHERD_TABS = [
  { key: "pending", label: "Needs a decision" },
  { key: "approved", label: "Approved" },
  { key: "closed", label: "Closed" },
] as const;

export default async function BookingPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const gate = await moduleGate("pastor_booking");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const shepherd = can(me.role, "manageBookings");
  const tab = shepherd ? (SHEPHERD_TABS.some((t) => t.key === searchParams.status) ? searchParams.status! : "pending") : "mine";
  const page = pageFrom(searchParams.page);

  let query = createClient()
    .from("pastor_bookings")
    .select("id, booking_type, preferred_date, preferred_time, status, requester:app_users!pastor_bookings_requested_by_fkey(name), pastor:app_users!pastor_bookings_pastor_id_fkey(name)")
    .eq("church_id", me.church_id)
    .order("preferred_date", { ascending: tab !== "closed" })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (tab === "mine") query = query.eq("requested_by", me.id);
  else if (tab === "closed") query = query.in("status", ["declined", "completed", "cancelled"]);
  else query = query.eq("status", tab);
  const { data, error } = await query;
  if (error) console.error("[booking] list failed:", error.message);

  const bookings: any[] = (data ?? []).slice(0, PAGE_SIZE);
  const requestButton = (
    <Link href="/dashboard/booking/new" className="btn-primary">
      Request a pastor
    </Link>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={shepherd ? "Booking requests" : "My booking requests"}
        description={
          shepherd
            ? "Requests from your church for weddings, funerals, baptisms, counselling and more."
            : "Ask a pastor for a wedding, funeral, baptism, counselling and more. You'll see their answer here."
        }
        actions={
          <>
            {shepherd && (
              <Link href="/dashboard/booking/availability" className="btn-secondary">
                Availability
              </Link>
            )}
            {requestButton}
          </>
        }
      />

      {shepherd && (
        <nav aria-label="Request status" className="mb-4 flex gap-1 border-b border-line overflow-x-auto">
          {SHEPHERD_TABS.map((t) => (
            <Link
              key={t.key}
              href={buildQuery({ status: t.key === "pending" ? undefined : t.key })}
              aria-current={tab === t.key ? "page" : undefined}
              className={`px-3 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === t.key ? "border-ember font-semibold" : "border-transparent text-ink/60 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      {error ? (
        <Alert tone="error" title="Couldn't load booking requests">Refresh the page to try again.</Alert>
      ) : bookings.length === 0 ? (
        shepherd ? (
          <EmptyState title={tab === "pending" ? "No requests waiting" : "Nothing here yet"} description={tab === "pending" ? "New requests from members will appear here." : undefined} />
        ) : (
          <EmptyState icon="📋" title="You haven't requested a booking yet" description="Ask a pastor for a wedding, baptism, counselling and more." action={requestButton} />
        )
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/booking/${b.id}`} className="card-elevated rounded-xl p-4 flex items-center justify-between gap-3 hover:border-gold/60">
                <div className="min-w-0">
                  <p className="font-semibold">{BOOKING_TYPE_LABELS[b.booking_type as keyof typeof BOOKING_TYPE_LABELS] ?? b.booking_type}</p>
                  <p className="text-sm text-ink/60">
                    {formatDate(b.preferred_date)}
                    {b.preferred_time ? ` at ${String(b.preferred_time).slice(0, 5)}` : ""}
                    {shepherd ? ` · from ${b.requester?.name ?? "former member"}` : ""}
                    {b.pastor?.name ? ` · with ${b.pastor.name}` : ""}
                  </p>
                </div>
                <BookingBadge status={b.status as BookingStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} hasMore={(data?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ status: shepherd && tab !== "pending" ? tab : undefined, page: p })} />
    </div>
  );
}
