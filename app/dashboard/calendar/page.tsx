import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { APP_TIMEZONE, formatDate, formatTime } from "@/lib/format";
import { RSVP_LABELS, type RsvpStatus } from "@/lib/events";
import { PAGE_SIZE, buildQuery, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function CalendarPage({ searchParams }: { searchParams: { when?: string; page?: string } }) {
  const gate = await moduleGate("calendar");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const past = searchParams.when === "past";
  const page = pageFrom(searchParams.page);

  let query = createClient()
    .from("events")
    .select("id, title, start_time, end_time, location, cancelled_at, departments(name), event_rsvps(status, user_id)")
    .eq("church_id", me.church_id)
    .order("start_time", { ascending: !past })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  // An event stays under "Upcoming" until it ends (or 3 hours after it starts).
  query = past ? query.lt("start_time", new Date(Date.now() - 3 * 3600_000).toISOString()) : query.gte("start_time", new Date(Date.now() - 3 * 3600_000).toISOString());
  const { data, error } = await query;
  if (error) console.error("[calendar] list failed:", error.message);

  const events: any[] = (data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (data?.length ?? 0) > PAGE_SIZE;
  const canCreate = can(me.role, "createEvents");
  const createButton = canCreate ? (
    <Link href="/dashboard/calendar/new" className="btn-primary">
      Create event
    </Link>
  ) : null;

  // Group by month for scanning ("October 2026").
  const groups = new Map<string, any[]>();
  for (const e of events) {
    const key = new Date(e.start_time).toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: APP_TIMEZONE });
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Calendar" description="Services, meetings and events for your church." actions={createButton} />

      <nav aria-label="Which events" className="mb-4 flex gap-1 border-b border-line">
        {[
          { key: "upcoming", label: "Upcoming" },
          { key: "past", label: "Past" },
        ].map((t) => {
          const active = (t.key === "past") === past;
          return (
            <Link
              key={t.key}
              href={buildQuery({ when: t.key === "past" ? "past" : undefined })}
              aria-current={active ? "page" : undefined}
              className={`px-3 py-2 text-sm -mb-px border-b-2 ${active ? "border-ember font-semibold" : "border-transparent text-ink/60 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <Alert tone="error" title="Couldn't load the calendar">Refresh the page to try again.</Alert>
      ) : events.length === 0 ? (
        past ? (
          <EmptyState title="No past events" description="Events move here once they're over." />
        ) : (
          <EmptyState
            icon="📅"
            title="Nothing scheduled yet"
            description={canCreate ? "Create your first event so the church knows what's coming up." : "When your church schedules events, they'll show here."}
            action={createButton}
          />
        )
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([month, list]) => (
            <section key={month} aria-labelledby={`m-${month}`}>
              <h2 id={`m-${month}`} className="text-sm font-semibold uppercase tracking-wide text-ink/50 mb-2">
                {month}
              </h2>
              <ul className="space-y-2">
                {list.map((e) => {
                  const going = e.event_rsvps?.filter((r: any) => r.status === "going").length ?? 0;
                  const mine = e.event_rsvps?.find((r: any) => r.user_id === me.id)?.status as RsvpStatus | undefined;
                  return (
                    <li key={e.id}>
                      <Link href={`/dashboard/calendar/${e.id}`} className="card-elevated rounded-xl p-4 flex gap-4 hover:border-gold/60">
                        <div className="w-14 shrink-0 text-center" aria-hidden>
                          <p className="text-xs uppercase text-ink/50">{new Date(e.start_time).toLocaleDateString("en-ZA", { weekday: "short", timeZone: APP_TIMEZONE })}</p>
                          <p className="text-2xl font-semibold leading-tight">{new Date(e.start_time).toLocaleDateString("en-ZA", { day: "numeric", timeZone: APP_TIMEZONE })}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold ${e.cancelled_at ? "line-through text-ink/50" : ""}`}>{e.title}</p>
                          <p className="text-sm text-ink/60">
                            <span className="sr-only">{formatDate(e.start_time)}, </span>
                            {formatTime(e.start_time)}
                            {e.end_time ? `–${formatTime(e.end_time)}` : ""}
                            {e.location ? ` · ${e.location}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {e.cancelled_at && <StatusBadge tone="danger">Cancelled</StatusBadge>}
                            {e.departments?.name && <StatusBadge tone="neutral">{e.departments.name}</StatusBadge>}
                            {!e.cancelled_at && <StatusBadge tone="neutral">{going} going</StatusBadge>}
                            {mine && !e.cancelled_at && <StatusBadge tone={mine === "going" ? "success" : "info"}>You: {RSVP_LABELS[mine]}</StatusBadge>}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Pagination page={page} hasMore={hasMore} hrefFor={(p) => buildQuery({ when: past ? "past" : undefined, page: p })} />
    </div>
  );
}
