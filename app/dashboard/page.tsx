import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { fetchVerse, verseRefForDate } from "@/lib/bible";
import { upcomingBirthdays, describeDaysUntil } from "@/lib/birthdays";

// Dashboard home. Every section below degrades on its own: a failed query
// renders that card's empty state rather than breaking the whole page.

const QUICK_LINKS = [
  { href: "/dashboard/prayer-board/wall", label: "Prayer wall", hint: "Pray for your church family" },
  { href: "/dashboard/bible", label: "Read the Bible", hint: "World English Bible" },
  { href: "/dashboard/bible/study", label: "Bible study AI", hint: "Explain, devotional, reading plan" },
  { href: "/dashboard/games", label: "Bible games", hint: "Quiz, word search, verse puzzle" },
  { href: "/dashboard/giving", label: "Give", hint: "Tithes & offerings" },
  { href: "/dashboard/journal", label: "Journal", hint: "Private & encrypted" },
];

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardHomePage() {
  const me = await getCurrentAppUser();
  if (!me) redirect("/login");
  if (me.role === "super_admin") redirect("/dashboard/super-admin");

  const supabase = createClient();
  const now = new Date();
  const isShepherd = ["pastor", "church_admin"].includes(me.role);
  const verseRef = verseRefForDate(now);

  const [verseText, eventsRes, announcementsRes] = await Promise.all([
    fetchVerse(verseRef),
    supabase
      .from("events")
      .select("id, title, start_time, location")
      .eq("church_id", me.church_id)
      .gte("start_time", now.toISOString())
      .order("start_time")
      .limit(3),
    supabase
      .from("announcements")
      .select("id, title, body, pinned, created_at")
      .eq("church_id", me.church_id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  let birthdays: ReturnType<typeof upcomingBirthdays> = [];
  let followUps: { id: string; member_name: string; follow_up_date: string; log_type: string }[] = [];

  if (isShepherd) {
    const [bdayRes, followRes] = await Promise.all([
      supabase
        .from("member_birthdays")
        .select("user_id, birth_date, app_users!member_birthdays_user_id_fkey(name, status)")
        .eq("church_id", me.church_id),
      supabase
        .from("pastoral_care_logs")
        .select("id, member_name, follow_up_date, log_type")
        .eq("church_id", me.church_id)
        .eq("follow_up_done", false)
        .not("follow_up_date", "is", null)
        .lte("follow_up_date", new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10))
        .order("follow_up_date")
        .limit(5),
    ]);

    birthdays = upcomingBirthdays(
      (bdayRes.data ?? [])
        .filter((b: any) => b.app_users?.status !== "disabled")
        .map((b: any) => ({ userId: b.user_id, name: b.app_users?.name ?? "Member", birthDate: b.birth_date })),
      now,
      7
    );
    followUps = (followRes.data as any) ?? [];
  }

  const events = eventsRes.data ?? [];
  const announcements = announcementsRes.data ?? [];

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <p className="text-sm text-ink/50">{greeting(now.getHours())},</p>
        <h1 className="text-3xl font-semibold">{me.name.split(" ")[0]}</h1>
        <div className="rule-gold mt-2" />
      </header>

      <section className="card-elevated rounded-2xl p-6" aria-labelledby="verse-heading">
        <p id="verse-heading" className="text-xs uppercase tracking-widest text-gold font-semibold">
          Verse of the day
        </p>
        {verseText ? (
          <blockquote className="mt-3 text-lg leading-relaxed" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            “{verseText}”
          </blockquote>
        ) : (
          <p className="mt-3 text-ink/60">
            We couldn't load today's verse text right now — open it in the Bible reader instead.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold">{verseRef} <span className="text-ink/40 font-normal">(WEB)</span></span>
          <Link href={`/dashboard/bible/study?ref=${encodeURIComponent(verseRef)}`} className="text-ember underline-offset-2 hover:underline">
            Study this verse →
          </Link>
        </div>
      </section>

      {isShepherd && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="card-elevated rounded-2xl p-5" aria-labelledby="bday-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="bday-heading" className="text-lg font-semibold">Birthdays this week</h2>
              <Link href="/dashboard/pastoral-care" className="text-xs text-ember">Care log</Link>
            </div>
            {birthdays.length === 0 ? (
              <p className="text-sm text-ink/50">
                No birthdays in the next 7 days. Add birth dates on each member's profile to get reminders here.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {birthdays.map((b) => (
                  <li key={b.userId} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-ink/50">
                        {describeDaysUntil(b.daysUntil)} · turning {b.turningAge}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/pastoral-care/new?member=${b.userId}&type=birthday_reachout`}
                      className="text-xs border border-ink/15 rounded-lg px-3 py-1.5 hover:bg-ink/5 shrink-0"
                    >
                      Log reach-out
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-elevated rounded-2xl p-5" aria-labelledby="follow-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="follow-heading" className="text-lg font-semibold">Follow-ups due</h2>
              <Link href="/dashboard/pastoral-care" className="text-xs text-ember">View all</Link>
            </div>
            {followUps.length === 0 ? (
              <p className="text-sm text-ink/50">Nothing due this week.</p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {followUps.map((f) => {
                  const overdue = f.follow_up_date < now.toISOString().slice(0, 10);
                  return (
                    <li key={f.id} className="py-2 flex items-center justify-between">
                      <p className="text-sm">{f.member_name}</p>
                      <p className={`text-xs ${overdue ? "text-red-700 font-semibold" : "text-ink/50"}`}>
                        {overdue ? "⚠ Overdue · " : ""}
                        {new Date(f.follow_up_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card-elevated rounded-2xl p-5" aria-labelledby="events-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="events-heading" className="text-lg font-semibold">Coming up</h2>
            <Link href="/dashboard/calendar" className="text-xs text-ember">Calendar</Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-ink/50">No upcoming events yet.</p>
          ) : (
            <ul className="space-y-3">
              {events.map((e: any) => (
                <li key={e.id}>
                  <Link href={`/dashboard/calendar/${e.id}`} className="block hover:opacity-80">
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-ink/50">
                      {new Date(e.start_time).toLocaleString(undefined, {
                        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-elevated rounded-2xl p-5" aria-labelledby="ann-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="ann-heading" className="text-lg font-semibold">Announcements</h2>
            <Link href="/dashboard/announcements" className="text-xs text-ember">See all</Link>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-ink/50">No announcements yet.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a: any) => (
                <li key={a.id}>
                  <p className="text-sm font-medium">{a.pinned ? "📌 " : ""}{a.title}</p>
                  <p className="text-xs text-ink/50 line-clamp-2">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="quick-heading">
        <h2 id="quick-heading" className="text-lg font-semibold mb-3">Quick access</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href} className="card-elevated rounded-xl p-4 hover:border-gold/60">
              <p className="text-sm font-semibold">{q.label}</p>
              <p className="text-xs text-ink/50 mt-1">{q.hint}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
