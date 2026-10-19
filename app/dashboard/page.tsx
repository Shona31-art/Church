import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getChurchAccess } from "@/lib/paywall";
import { can, isShepherd } from "@/lib/permissions";
import { verseRefForDate } from "@/lib/bible";
import { parseReference } from "@/lib/bible/reference";
import { readerHref } from "@/lib/bible/books";
import { fetchVerse } from "@/lib/bible/text";
import { upcomingBirthdays, describeDaysUntil } from "@/lib/birthdays";
import { APP_TIMEZONE, formatDate, formatMoney, formatTime, todayInAppZone } from "@/lib/format";
import { PLAN_LABELS, type ModuleKey } from "@/lib/subscription";
import { Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  ArrowRight,
  BookOpen,
  Cake,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  Gamepad2,
  Gift,
  HandHeart,
  Megaphone,
  NotebookPen,
  Pin,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Dashboard home, shaped by role. Every card degrades on its own: a failed
// query shows that card's empty state rather than breaking the page. Only
// counts and titles appear here — confidential detail stays on its own page.

function greeting(now: Date) {
  const hour = Number(now.toLocaleString("en-ZA", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface Attention {
  label: string;
  count: number;
  href: string;
  tone: "warning" | "info" | "danger";
}

export default async function DashboardHomePage() {
  const me = await getCurrentAppUser();
  if (!me) redirect("/login");
  if (me.role === "super_admin") redirect("/dashboard/super-admin");

  const supabase = createClient();
  const access = await getChurchAccess();
  const has = (m: ModuleKey) => Boolean(access?.modules.has(m));
  const now = new Date();
  const today = todayInAppZone(now);
  const shepherd = isShepherd(me.role);
  const admin = can(me.role, "manageBilling");
  const verseRef = verseRefForDate(now);
  const in7Days = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const yearStart = `${today.slice(0, 4)}-01-01T00:00:00Z`;
  const none = Promise.resolve({ data: null, count: null, error: null } as any);

  const [
    verseText,
    eventsRes,
    announcementsRes,
    memberCountRes,
    newMembersRes,
    invitedRes,
    pendingBookingsRes,
    openTicketsRes,
    flaggedCounselingRes,
    sharedPrayersRes,
    givingRes,
    myBookingsRes,
    deptMembersRes,
    bdayRes,
    followRes,
  ] = await Promise.all([
    fetchVerse(verseRef),
    has("calendar")
      ? supabase
          .from("events")
          .select("id, title, start_time, location, departments(name)")
          .eq("church_id", me.church_id)
          .is("cancelled_at", null)
          .gte("start_time", now.toISOString())
          .order("start_time")
          .limit(4)
      : none,
    has("announcements")
      ? supabase
          .from("announcements")
          .select("id, title, body, pinned, created_at")
          .eq("church_id", me.church_id)
          .eq("status", "published")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(3)
      : none,
    shepherd ? supabase.from("app_users").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).neq("status", "disabled") : none,
    shepherd ? supabase.from("app_users").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).gte("created_at", monthAgo) : none,
    shepherd ? supabase.from("app_users").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).eq("status", "invited") : none,
    shepherd && has("pastor_booking")
      ? supabase.from("pastor_bookings").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).eq("status", "pending")
      : none,
    admin && has("support")
      ? supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).neq("status", "closed")
      : none,
    shepherd && has("ai_counseling")
      ? supabase.from("counseling_conversations").select("id", { count: "exact", head: true }).eq("church_id", me.church_id).eq("flagged", true)
      : none,
    has("prayer_board")
      ? supabase
          .from("prayer_board_items")
          .select("id", { count: "exact", head: true })
          .eq("church_id", me.church_id)
          .eq("is_shared_request", true)
          .eq("status", "active")
      : none,
    admin && has("giving")
      ? supabase.from("givings").select("amount_cents").eq("church_id", me.church_id).eq("status", "succeeded").gte("created_at", yearStart).limit(5000)
      : none,
    !shepherd && has("pastor_booking")
      ? supabase.from("pastor_bookings").select("id, booking_type, status, preferred_date").eq("requested_by", me.id).in("status", ["pending", "approved"]).order("preferred_date").limit(3)
      : none,
    me.role === "department_leader" && me.department_id
      ? supabase.from("app_users").select("id", { count: "exact", head: true }).eq("department_id", me.department_id).neq("status", "disabled")
      : none,
    shepherd && has("pastoral_care")
      ? supabase.from("member_birthdays").select("user_id, birth_date, app_users!member_birthdays_user_id_fkey(name, status)").eq("church_id", me.church_id)
      : none,
    shepherd && has("pastoral_care")
      ? supabase
          .from("pastoral_care_logs")
          .select("id, member_name, follow_up_date, log_type")
          .eq("church_id", me.church_id)
          .eq("follow_up_done", false)
          .not("follow_up_date", "is", null)
          .lte("follow_up_date", in7Days)
          .order("follow_up_date")
          .limit(5)
      : none,
  ]);

  const birthdays = bdayRes.data
    ? upcomingBirthdays(
        (bdayRes.data as any[])
          .filter((b) => b.app_users && b.app_users.status !== "disabled")
          .map((b) => ({ userId: b.user_id, name: b.app_users.name, birthDate: b.birth_date })),
        now,
        7
      )
    : [];
  const followUps: { id: string; member_name: string; follow_up_date: string }[] = followRes.data ?? [];
  const events: any[] = eventsRes.data ?? [];
  const announcements: any[] = announcementsRes.data ?? [];
  const givingTotal = ((givingRes.data as { amount_cents: number }[] | null) ?? []).reduce((s, g) => s + g.amount_cents, 0);

  const attention: Attention[] = [
    { label: "Booking requests waiting for a decision", count: pendingBookingsRes.count ?? 0, href: "/dashboard/booking?status=pending", tone: "warning" as const },
    { label: "Counseling conversations flagged for pastoral follow-up", count: flaggedCounselingRes.count ?? 0, href: "/dashboard/counseling", tone: "danger" as const },
    { label: "Follow-ups due this week", count: followUps.length, href: "/dashboard/pastoral-care?due=1", tone: "warning" as const },
    { label: "Invites not yet accepted", count: invitedRes.count ?? 0, href: "/dashboard/members?status=invited", tone: "info" as const },
    { label: "Open support tickets", count: openTicketsRes.count ?? 0, href: "/dashboard/support", tone: "info" as const },
  ].filter((a) => a.count > 0);

  const firstName = me.name.split(" ")[0];
  const verseLink = parseReference(verseRef);
  const canPost = has("announcements") && can(me.role, "postAnnouncements");
  const canAddEvent = has("calendar") && can(me.role, "createEvents");

  const verse = (
    <section aria-labelledby="verse-heading" className="flex flex-col rounded-2xl bg-panel p-6 text-on-panel shadow-card sm:p-8">
      <h2 id="verse-heading" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">
        Verse of the day
      </h2>
      {verseText ? (
        <blockquote className="mt-4 max-w-3xl flex-1 font-display text-xl leading-relaxed sm:text-[22px]">“{verseText}”</blockquote>
      ) : (
        <p className="mt-4 flex-1 text-on-panel/75">We couldn&apos;t load today&apos;s verse text right now — open it in the Bible reader instead.</p>
      )}
      <div className="rule-gold mt-5" />
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-semibold">
          {verseRef} <span className="font-normal text-on-panel/65">(WEB)</span>
        </span>
        {has("bible") && verseLink && (
          <Link href={readerHref({ ...verseLink })} className="font-medium text-on-panel/85 underline-offset-4 hover:text-on-panel hover:underline">
            Read in context
          </Link>
        )}
        {has("bible_study_ai") && (
          <Link
            href={`/dashboard/bible/study?ref=${encodeURIComponent(verseRef)}`}
            className="inline-flex items-center gap-1 font-medium text-on-panel/85 underline-offset-4 hover:text-on-panel hover:underline"
          >
            Study this verse <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );

  return (
    <div className="max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDate(now, { weekday: "long", month: "long", year: undefined })}</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight sm:text-[32px]">
            {greeting(now)}, {firstName}
          </h1>
          <div className="rule-gold mt-3" />
        </div>
        {(canPost || canAddEvent) && (
          <div className="flex flex-wrap gap-2">
            {canAddEvent && (
              <Link href="/dashboard/calendar/new" className="btn-secondary">
                <CalendarPlus aria-hidden className="h-4 w-4" /> New event
              </Link>
            )}
            {canPost && (
              <Link href="/dashboard/announcements/new" className="btn-primary">
                <Megaphone aria-hidden className="h-4 w-4" /> New announcement
              </Link>
            )}
          </div>
        )}
      </header>

      {shepherd && (
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">Church at a glance</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Active members" value={String(memberCountRes.count ?? 0)} href="/dashboard/members" />
            <Stat label="New in the last 30 days" value={String(newMembersRes.count ?? 0)} href="/dashboard/members" />
            <Stat label="Praying together" value={String(sharedPrayersRes.count ?? 0)} hint="requests on the wall" href="/dashboard/prayer-board/wall" />
            {admin && has("giving") ? (
              <Stat label={`Giving in ${today.slice(0, 4)}`} value={formatMoney(givingTotal)} href="/dashboard/giving/report" />
            ) : (
              <Stat label="Upcoming events" value={String(events.length)} href="/dashboard/calendar" />
            )}
          </div>
        </section>
      )}

      {shepherd ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <Section title="Needs your attention" className="lg:col-span-3">
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink/70">
                <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
                You&apos;re all caught up. Nothing is waiting on you right now.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link href={a.href} className="group -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-ink/[0.03]">
                      <span className="text-sm">{a.label}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge tone={a.tone}>{a.count}</StatusBadge>
                        <ChevronRight aria-hidden className="h-4 w-4 text-ink/60 group-hover:text-ink/70" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <div className="lg:col-span-2">{verse}</div>
        </div>
      ) : (
        verse
      )}

      {me.role === "department_leader" && (
        <Section title="Your department">
          {me.department_id ? (
            <p className="text-sm">
              {deptMembersRes.count ?? 0} {deptMembersRes.count === 1 ? "member" : "members"} in your department.{" "}
              <span className="text-ink/60">Post to them from </span>
              <Link href="/dashboard/announcements/new" className="link">Announcements</Link>
              <span className="text-ink/60"> or plan something in the </span>
              <Link href="/dashboard/calendar/new" className="link">Calendar</Link>.
            </p>
          ) : (
            <p className="text-sm text-ink/60">You&apos;re not assigned to a department yet — ask a church admin to add you to one.</p>
          )}
        </Section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {has("calendar") && (
          <Section title="Coming up" actions={<Link href="/dashboard/calendar" className="btn-ghost btn-sm">Calendar</Link>}>
            {events.length === 0 ? (
              <EmptyLine
                text="No upcoming events yet."
                action={canAddEvent ? <Link href="/dashboard/calendar/new" className="btn-secondary btn-sm">Add an event</Link> : null}
              />
            ) : (
              <ul className="space-y-1">
                {events.map((e) => (
                  <li key={e.id}>
                    <Link href={`/dashboard/calendar/${e.id}`} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-2 hover:bg-ink/[0.03]">
                      <DateTile value={e.start_time} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{e.title}</p>
                        <p className="truncate text-xs text-ink/60">
                          {formatDate(e.start_time, { year: undefined })} · {formatTime(e.start_time)}
                          {e.location ? ` · ${e.location}` : ""}
                          {e.departments?.name ? ` · ${e.departments.name}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {has("announcements") && (
          <Section title="Announcements" actions={<Link href="/dashboard/announcements" className="btn-ghost btn-sm">See all</Link>}>
            {announcements.length === 0 ? (
              <EmptyLine
                text="No announcements yet."
                action={canPost ? <Link href="/dashboard/announcements/new" className="btn-secondary btn-sm">Post an announcement</Link> : null}
              />
            ) : (
              <ul className="divide-y divide-line">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <Link href={`/dashboard/announcements/${a.id}`} className="-mx-2 block rounded-lg px-2 py-3 hover:bg-ink/[0.03]">
                      <p className="text-sm font-semibold">
                        {a.pinned && <span className="sr-only">Pinned: </span>}
                        {a.pinned && <Pin aria-hidden className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-gold" />}
                        {a.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink/60">{a.body}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {!shepherd && has("pastor_booking") && (myBookingsRes.data?.length ?? 0) > 0 && (
          <Section title="My booking requests" actions={<Link href="/dashboard/booking" className="btn-ghost btn-sm">All requests</Link>}>
            <ul className="divide-y divide-line">
              {(myBookingsRes.data as any[]).map((b) => (
                <li key={b.id}>
                  <Link href={`/dashboard/booking/${b.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-ink/[0.03]">
                    <span className="capitalize">
                      {b.booking_type} · {formatDate(b.preferred_date, { weekday: undefined })}
                    </span>
                    <StatusBadge tone={b.status === "approved" ? "success" : "warning"}>{b.status === "approved" ? "Approved" : "Pending"}</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {shepherd && has("pastoral_care") && (
          <Section title="Birthdays this week" actions={<Link href="/dashboard/pastoral-care" className="btn-ghost btn-sm">Care log</Link>}>
            {birthdays.length === 0 ? (
              <EmptyLine text="No birthdays in the next 7 days. Add birth dates on member profiles to get reminders here." />
            ) : (
              <ul className="divide-y divide-line">
                {birthdays.map((b) => (
                  <li key={b.userId} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Cake aria-hidden className="h-4 w-4 shrink-0 text-gold" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-ink/60">
                          {describeDaysUntil(b.daysUntil)} · turning {b.turningAge}
                        </p>
                      </div>
                    </div>
                    <Link href={`/dashboard/pastoral-care/new?member=${b.userId}&type=birthday_reachout`} className="btn-secondary btn-sm shrink-0">
                      Log reach-out
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {shepherd && has("pastoral_care") && (
          <Section title="Follow-ups due" actions={<Link href="/dashboard/pastoral-care?due=1" className="btn-ghost btn-sm">View all</Link>}>
            {followUps.length === 0 ? (
              <EmptyLine text="Nothing due this week." />
            ) : (
              <ul className="divide-y divide-line">
                {followUps.map((f) => {
                  const overdue = f.follow_up_date < today;
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                      <p className="text-sm">{f.member_name}</p>
                      {overdue ? (
                        <StatusBadge tone="danger">Overdue · {formatDate(f.follow_up_date, { weekday: undefined, year: undefined })}</StatusBadge>
                      ) : (
                        <span className="tabular text-xs text-ink/60">{formatDate(f.follow_up_date, { year: undefined })}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        )}
      </div>

      <QuickLinks has={has} />

      {admin && access?.planKey && (
        <p className="text-xs text-ink/60">
          Plan: {PLAN_LABELS[access.planKey] ?? access.planKey}.{" "}
          <Link href="/dashboard/billing" className="link">
            Billing
          </Link>
        </p>
      )}
    </div>
  );
}

/** One-line empty state inside a home-page card, with the fix when the viewer can make it. */
function EmptyLine({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink/60">{text}</p>
      {action}
    </div>
  );
}

/** Calendar-style month/day tile for event rows. */
function DateTile({ value }: { value: string }) {
  return (
    <span aria-hidden className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-parchment">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/60">
        {formatDate(value, { weekday: undefined, day: undefined, year: undefined, month: "short" })}
      </span>
      <span className="tabular text-lg font-semibold leading-none">{formatDate(value, { weekday: undefined, month: undefined, year: undefined, day: "numeric" })}</span>
    </span>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href: string }) {
  return (
    <Link href={href} className="card-interactive group block rounded-2xl p-4 sm:p-5">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <p className="tabular mt-2 truncate text-[26px] font-semibold leading-none tracking-[-0.01em] sm:text-[28px]">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-ink/60">{hint}</p>}
    </Link>
  );
}

const QUICK_LINKS: { href: string; label: string; hint: string; module: ModuleKey; Icon: LucideIcon }[] = [
  { href: "/dashboard/prayer-board/wall", label: "Prayer wall", hint: "Pray for your church family", module: "prayer_board", Icon: HandHeart },
  { href: "/dashboard/bible", label: "Read the Bible", hint: "World English Bible", module: "bible", Icon: BookOpen },
  { href: "/dashboard/bible/study", label: "Bible study AI", hint: "Explain, devotional, reading plan", module: "bible_study_ai", Icon: Sparkles },
  { href: "/dashboard/games", label: "Bible games", hint: "Quiz, word search, verse puzzle", module: "bible_games", Icon: Gamepad2 },
  { href: "/dashboard/giving", label: "Give", hint: "Tithes & offerings", module: "giving", Icon: Gift },
  { href: "/dashboard/journal", label: "Journal", hint: "Private & encrypted", module: "journal", Icon: NotebookPen },
];

function QuickLinks({ has }: { has: (m: ModuleKey) => boolean }) {
  const links = QUICK_LINKS.filter((q) => has(q.module));
  if (!links.length) return null;
  return (
    <section aria-labelledby="quick-heading">
      <h2 id="quick-heading" className="mb-4 text-xl font-semibold">
        Quick access
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, label, hint, Icon }) => (
          <Link key={href} href={href} className="card-interactive flex items-center gap-4 rounded-2xl p-4">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-parchment text-gold">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block truncate text-xs text-ink/60">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
