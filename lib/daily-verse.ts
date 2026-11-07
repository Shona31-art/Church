import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verseRefForDate } from "@/lib/bible";
import { fetchVerse } from "@/lib/bible/text";
import { parseReference } from "@/lib/bible/reference";
import { readerHref } from "@/lib/bible/books";
import { todayInAppZone } from "@/lib/format";

/**
 * The home page's verse of the day as a notification to everyone who uses
 * Grace (not record-only members, not people who switched it off). Tapping it
 * opens the passage in the Bible reader. Once a day per church — sent by the
 * 07:00 job, or by the catch-up when someone opens the app and the job hasn't
 * run (`onlyChurch`).
 */
export async function sendDailyVerse(today = todayInAppZone(), onlyChurch?: string): Promise<number> {
  const admin = createAdminClient();
  const ref = verseRefForDate(new Date(`${today}T12:00:00Z`));
  const text = await fetchVerse(ref).catch(() => null);
  const parsed = parseReference(ref);
  const link = parsed ? readerHref({ bookIndex: parsed.bookIndex, chapter: parsed.chapter, verse: parsed.verse, verseEnd: parsed.verseEnd }) : "/dashboard/bible";
  const body = text ? `${ref} — “${text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text}”` : ref;

  let peopleQuery = admin.from("app_users").select("*").eq("status", "active").not("church_id", "is", null).neq("role", "super_admin");
  if (onlyChurch) peopleQuery = peopleQuery.eq("church_id", onlyChurch);
  // Churches that already had today's verse (the job or an earlier catch-up).
  let doneQuery = admin.from("notifications").select("church_id").eq("type", "bible.daily_verse").gte("created_at", `${today}T00:00:00+02:00`);
  if (onlyChurch) doneQuery = doneQuery.eq("church_id", onlyChurch).limit(1);
  else doneQuery = doneQuery.limit(50000);
  const [{ data: people }, { data: optedOut }, { data: done }] = await Promise.all([
    peopleQuery.limit(20000),
    admin.from("notification_preferences").select("user_id").eq("daily_verse", false).limit(20000),
    doneQuery,
  ]);
  const doneChurches = new Set(((done ?? []) as { church_id: string | null }[]).map((d) => d.church_id));
  const off = new Set(((optedOut ?? []) as { user_id: string }[]).map((p) => p.user_id));
  const wanted = ((people ?? []) as { id: string; church_id: string; record_only?: boolean }[]).filter((p) => !p.record_only && !off.has(p.id) && !doneChurches.has(p.church_id));

  // Claim the day for each church (record_members.sql: daily_runs) so the job
  // and a catch-up running at the same moment can't both send it.
  const claimed = new Set<string>();
  for (const churchId of new Set(wanted.map((p) => p.church_id))) {
    const { error } = await admin.from("daily_runs").insert({ church_id: churchId, day: today, kind: "verse" });
    if (!error || error.code !== "23505") claimed.add(churchId); // missing table (before #63): go ahead
  }
  const recipients = wanted.filter((p) => claimed.has(p.church_id));

  let sent = 0;
  for (let i = 0; i < recipients.length; i += 500) {
    const batch = recipients.slice(i, i + 500).map((p) => ({ user_id: p.id, church_id: p.church_id, category: "church_news", type: "bible.daily_verse", title: "Your verse for today", body, link }));
    const { error } = await admin.from("notifications").insert(batch);
    if (error) console.error("[daily verse] batch failed:", error.message);
    else sent += batch.length;
  }
  return sent;
}
