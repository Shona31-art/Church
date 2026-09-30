import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function CalendarPage() {
  const access = await checkModuleAccess("calendar");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: events } = await supabase
    .from("events")
    .select("*, departments(name), event_rsvps(status, user_id)")
    .eq("church_id", me!.church_id)
    .gte("start_time", new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
    .order("start_time");

  const canPost = me && ["church_admin", "pastor", "department_leader"].includes(me.role);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        {canPost && (
          <Link
            href="/dashboard/calendar/new"
            className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + New event
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {events?.map((e: any) => {
          const goingCount = e.event_rsvps?.filter((r: any) => r.status === "going").length ?? 0;
          const myRsvp = e.event_rsvps?.find((r: any) => r.user_id === me!.id)?.status;

          return (
            <Link
              key={e.id}
              href={`/dashboard/calendar/${e.id}`}
              className="block border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-ink/50">
                    {new Date(e.start_time).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {e.location && ` · ${e.location}`}
                  </p>
                </div>
                <div className="text-right text-xs text-ink/40">
                  {e.departments?.name && <p>{e.departments.name}</p>}
                  <p>{goingCount} going{myRsvp ? ` · you: ${myRsvp}` : ""}</p>
                </div>
              </div>
            </Link>
          );
        })}
        {!events?.length && <p className="text-ink/40 text-sm">No upcoming events.</p>}
      </div>
    </div>
  );
}
