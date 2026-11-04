import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteLink } from "@/lib/alert-delivery";
import { APP_TIMEZONE, todayInAppZone } from "@/lib/format";
import { emailConfigured, sendEmail } from "@/lib/email";
import { chainSchedule, slotStarts } from "@/lib/prayer-chain";
import { weeklyReportEmail, type WeeklyReport } from "@/lib/weekly-report-email";

// The Monday morning report (church_life.sql). Built with the service client
// so the nightly job can send it; pages that show it check the viewer is a
// pastor/admin of that church first. Counts and names only — no prayer text,
// care notes or anything from counselling or journals.

const DAY = 86_400_000;
const md = (iso: string) => iso.slice(5, 10);
const label = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-ZA", { timeZone: APP_TIMEZONE, ...opts });

/** Monday 00:00 of this week (in the app's time zone) as YYYY-MM-DD. */
export function weekStart(today = todayInAppZone()): string {
  const d = new Date(`${today}T12:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
}

export async function buildWeeklyReport(churchId: string, today = todayInAppZone()): Promise<WeeklyReport | null> {
  const admin = createAdminClient();
  const thisMonday = new Date(`${weekStart(today)}T00:00:00+02:00`); // South Africa: UTC+2 all year
  const from = new Date(thisMonday.getTime() - 7 * DAY);
  const ahead = new Date(thisMonday.getTime() + 7 * DAY);
  const iso = (d: Date) => d.toISOString();
  const safe = <T,>(p: PromiseLike<{ data: T | null; count?: number | null; error: unknown }>) => Promise.resolve(p).then((r) => (r.error ? { data: null, count: 0 } : r)).catch(() => ({ data: null, count: 0 }));

  const { data: church } = await admin.from("churches").select("name").eq("id", churchId).maybeSingle();
  if (!church) return null;

  const [newbies, chains, lives, shared, prayersNew, prayersAnswered, gifts, reported, bdays, kids, events, bookings, testimonies, gaps, plans, members] = await Promise.all([
    // Joined the app last week (signed in at least once: active, not just invited).
    safe(admin.from("app_users").select("*").eq("church_id", churchId).eq("status", "active").gte("created_at", iso(from)).lt("created_at", iso(thisMonday)).order("name").limit(30)),
    safe(admin.from("prayer_chains").select("*").eq("church_id", churchId).gt("ends_at", iso(thisMonday)).lt("starts_at", iso(ahead)).order("starts_at").limit(5)),
    safe(admin.from("live_services").select("title, starts_at").eq("church_id", churchId).gte("starts_at", iso(thisMonday)).lt("starts_at", iso(ahead)).order("starts_at").limit(5)),
    safe(admin.from("testimonies").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "approved").gte("reviewed_at", iso(from)).lt("reviewed_at", iso(thisMonday))),
    safe(admin.from("prayer_board_items").select("id", { count: "exact", head: true }).eq("church_id", churchId).gte("created_at", iso(from)).lt("created_at", iso(thisMonday))),
    safe(admin.from("prayer_board_items").select("id", { count: "exact", head: true }).eq("church_id", churchId).gte("answered_at", iso(from)).lt("answered_at", iso(thisMonday))),
    safe(admin.from("givings").select("amount_cents").eq("church_id", churchId).eq("status", "succeeded").gte("created_at", iso(from)).lt("created_at", iso(thisMonday)).limit(5000)),
    safe(admin.from("givings").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "reported")),
    safe(admin.from("member_birthdays").select("birth_date, app_users!inner(name, status)").eq("church_id", churchId).limit(5000)),
    safe(admin.from("member_children").select("name, birth_date").eq("church_id", churchId).not("birth_date", "is", null).limit(5000)),
    safe(admin.from("events").select("title, start_time").eq("church_id", churchId).is("cancelled_at", null).gte("start_time", iso(thisMonday)).lt("start_time", iso(ahead)).order("start_time").limit(10)),
    safe(admin.from("pastor_bookings").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending")),
    safe(admin.from("testimonies").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending")),
    safe(admin.from("roster_duties").select("duty_date, user_id, swap_requested, roster_teams(name)").eq("church_id", churchId).gte("duty_date", weekStart(today)).lt("duty_date", iso(ahead).slice(0, 10)).or("user_id.is.null,swap_requested.eq.true").order("duty_date").limit(20)),
    safe(admin.from("reading_plans").select("id, title, start_date, days").eq("church_id", churchId).eq("church_wide", true).limit(20)),
    safe(admin.from("reading_plan_members").select("plan_id").eq("church_id", churchId).limit(10000)),
  ]);

  // Birthdays from today's Monday to Sunday (day and month only — never ages).
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(thisMonday.getTime() + i * DAY + 12 * 3_600_000));
  const whenFor = (birth: string) => {
    const d = weekDays.find((w) => md(w.toISOString()) === md(birth));
    return d ? label(d, { weekday: "long", day: "numeric", month: "short" }) : null;
  };
  const birthdays = [
    ...(((bdays.data ?? []) as any[]).filter((b) => b.app_users?.status === "active").map((b) => ({ name: b.app_users.name as string, birth: b.birth_date as string, child: false }))),
    ...(((kids.data ?? []) as any[]).map((k) => ({ name: k.name as string, birth: k.birth_date as string, child: true }))),
  ]
    .map((b) => ({ ...b, when: whenFor(b.birth) }))
    .filter((b): b is typeof b & { when: string } => Boolean(b.when))
    .sort((a, b) => md(a.birth).localeCompare(md(b.birth)))
    .map(({ name, when, child }) => ({ name, when, child }));

  const giftRows = (gifts.data ?? []) as { amount_cents: number }[];
  const readers = (id: string) => ((members.data ?? []) as { plan_id: string }[]).filter((m) => m.plan_id === id).length;
  const activePlans = ((plans.data ?? []) as any[]).filter((p) => {
    const end = Date.parse(`${p.start_date}T00:00:00Z`) + (p.days as unknown[]).length * DAY;
    return Date.parse(`${p.start_date}T00:00:00Z`) <= ahead.getTime() && end >= from.getTime();
  });

  const nb = bookings.count ?? 0;
  const nt = testimonies.count ?? 0;
  const needsAttention = [
    { label: `booking ${nb === 1 ? "request" : "requests"} waiting`, count: nb, link: "/dashboard/booking" },
    { label: `${nt === 1 ? "testimony" : "testimonies"} waiting for approval`, count: nt, link: "/dashboard/testimonies?tab=review" },
  ].filter((n) => n.count > 0);

  const sunday = new Date(thisMonday.getTime() - DAY + 12 * 3_600_000);
  const fmt = (d: string | Date) => new Date(d).toLocaleString("en-ZA", { timeZone: APP_TIMEZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  // Prayer chains running or starting this week, with how many slots are covered.
  const chainRows = (chains.data ?? []) as any[];
  const { data: slotRows } = chainRows.length
    ? await admin.from("prayer_chain_slots").select("chain_id, slot_start").in("chain_id", chainRows.map((c) => c.id)).limit(20000)
    : { data: [] as { chain_id: string; slot_start: string }[] };
  const prayerChains = chainRows.map((c) => {
    const all = slotStarts(c);
    const taken = new Set(((slotRows ?? []) as { chain_id: string; slot_start: string }[]).filter((s) => s.chain_id === c.id).map((s) => Date.parse(s.slot_start)));
    return { title: c.title, when: `${fmt(c.starts_at)} – ${fmt(c.ends_at)}`, schedule: chainSchedule(c), covered: all.filter((t) => taken.has(t)).length, total: all.length };
  });
  return {
    churchName: church.name,
    weekLabel: `${label(from, { day: "numeric", month: "short" })} – ${label(sunday, { day: "numeric", month: "short" })}`,
    // Record-only members (record_members.sql) were added to the records, not to the app.
    newMembers: ((newbies.data ?? []) as { name: string; record_only?: boolean }[]).filter((n) => !n.record_only).map((n) => ({ name: n.name })),
    prayerChains,
    liveServices: ((lives.data ?? []) as any[]).map((l) => ({ title: l.title, when: fmt(l.starts_at) })),
    testimoniesShared: shared.count ?? 0,
    prayer: { newRequests: prayersNew.count ?? 0, answered: prayersAnswered.count ?? 0 },
    giving: gifts.data ? { totalCents: giftRows.reduce((s, g) => s + (g.amount_cents ?? 0), 0), gifts: giftRows.length, awaitingConfirmation: reported.count ?? 0 } : null,
    birthdays,
    events: ((events.data ?? []) as any[]).map((e) => ({ title: e.title, when: new Date(e.start_time).toLocaleString("en-ZA", { timeZone: APP_TIMEZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) })),
    needsAttention,
    rosterGaps: ((gaps.data ?? []) as any[]).map((g) => ({ team: g.roster_teams?.name ?? "Team", when: label(new Date(`${g.duty_date}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short" }), why: g.user_id ? "swap" : "nobody" })),
    readingPlans: activePlans.map((p) => ({ title: p.title, readers: readers(p.id) })),
    appUrl: absoluteLink("/dashboard"),
  };
}

/** The church's active pastors and church admins with an email. */
async function shepherdEmails(churchId: string) {
  const { data } = await createAdminClient().from("app_users").select("email, name").eq("church_id", churchId).eq("status", "active").in("role", ["pastor", "church_admin"]);
  return ((data ?? []) as { email: string | null; name: string }[]).filter((u) => u.email).map((u) => ({ email: u.email!, name: u.name }));
}

/** Send one church's report to the given people (or all its pastors/admins). */
export async function sendWeeklyReport(churchId: string, to?: { email: string; name?: string | null }[]): Promise<boolean> {
  const report = await buildWeeklyReport(churchId);
  if (!report) return false;
  const recipients = to ?? (await shepherdEmails(churchId));
  if (!recipients.length) return false;
  const { subject, html, text } = weeklyReportEmail(report);
  return sendEmail({ to: recipients, subject, html, text });
}

/**
 * Nightly job: on Mondays, every church whose plan includes the report gets
 * it once (weekly_report_log). Returns how many were sent.
 */
export async function sendDueWeeklyReports(today = todayInAppZone()): Promise<number> {
  if (!emailConfigured()) return 0;
  if (new Date(`${today}T12:00:00Z`).getUTCDay() !== 1) return 0;
  const admin = createAdminClient();
  const week = weekStart(today);
  const [{ data: subs }, { data: planMods }, { data: overrides }] = await Promise.all([
    admin.from("church_subscriptions").select("church_id, plan_key, status").in("status", ["active", "trial", "grace"]).limit(5000),
    admin.from("plan_modules").select("plan_key").eq("module_key", "weekly_report"),
    admin.from("church_modules").select("church_id, enabled").eq("module_key", "weekly_report"),
  ]);
  const plans = new Set((planMods ?? []).map((p) => p.plan_key));
  // Churches that switched the report off (church_life_v2.sql); none before that's run.
  const { data: off } = await admin.from("churches").select("id").eq("weekly_report_enabled", false);
  const switchedOff = new Set((off ?? []).map((c) => c.id));
  let sent = 0;
  for (const s of subs ?? []) {
    if (switchedOff.has(s.church_id)) continue;
    const override = (overrides ?? []).find((o: any) => o.church_id === s.church_id) as { enabled?: boolean } | undefined;
    if (!(override ? override.enabled !== false : plans.has(s.plan_key))) continue;
    const { error } = await admin.from("weekly_report_log").insert({ church_id: s.church_id, week_start: week });
    if (error) continue; // already sent this week (or the table isn't there yet)
    if (await sendWeeklyReport(s.church_id)) sent++;
    // Not sent: forget it, so a later run today (or "Email it to me" on the report page) can.
    else await admin.from("weekly_report_log").delete().eq("church_id", s.church_id).eq("week_start", week);
  }
  return sent;
}
