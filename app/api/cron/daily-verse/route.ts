import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verseRefForDate } from "@/lib/bible";
import { fetchVerse } from "@/lib/bible/text";
import { parseReference } from "@/lib/bible/reference";
import { readerHref } from "@/lib/bible/books";
import { todayInAppZone } from "@/lib/format";
import { sendBirthdayGreetings } from "@/lib/birthdays-today";

/**
 * GET /api/cron/daily-verse — every morning (Vercel Cron, vercel.json): birthday
 * greetings and posters (lib/birthdays-today.ts), then the
 * home page's verse of the day as a notification to everyone who uses Grace
 * (not record-only members, not people who switched it off). Tapping it opens
 * the passage in the Bible reader. Sent once a day.
 *
 * Request: header `Authorization: Bearer <CRON_SECRET>`.
 * Response: 200 { sent } · 401
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const today = todayInAppZone();

  // Birthdays first (record_members.sql): notifications and a poster in General.
  let birthdays = { churches: 0, people: 0, posters: 0 };
  try {
    birthdays = await sendBirthdayGreetings(today);
  } catch (error) {
    console.error("[cron] birthdays failed:", (error as Error).message);
  }

  // Once a day, even if the job runs twice.
  const { count: already } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "bible.daily_verse")
    .gte("created_at", `${today}T00:00:00+02:00`);
  if (already) return NextResponse.json({ sent: 0, already: true, birthdays });

  const ref = verseRefForDate(new Date(`${today}T12:00:00Z`));
  const text = await fetchVerse(ref).catch(() => null);
  const parsed = parseReference(ref);
  const link = parsed ? readerHref({ bookIndex: parsed.bookIndex, chapter: parsed.chapter, verse: parsed.verse, verseEnd: parsed.verseEnd }) : "/dashboard/bible";
  const body = text ? `${ref} — “${text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text}”` : ref;

  const [{ data: people }, { data: optedOut }] = await Promise.all([
    admin.from("app_users").select("*").eq("status", "active").not("church_id", "is", null).neq("role", "super_admin").limit(20000),
    admin.from("notification_preferences").select("user_id").eq("daily_verse", false).limit(20000),
  ]);
  const off = new Set(((optedOut ?? []) as { user_id: string }[]).map((p) => p.user_id));
  const recipients = ((people ?? []) as { id: string; church_id: string; record_only?: boolean }[]).filter((p) => !p.record_only && !off.has(p.id));

  let sent = 0;
  for (let i = 0; i < recipients.length; i += 500) {
    const batch = recipients.slice(i, i + 500).map((p) => ({ user_id: p.id, church_id: p.church_id, category: "church_news", type: "bible.daily_verse", title: "Your verse for today", body, link }));
    const { error } = await admin.from("notifications").insert(batch);
    if (error) console.error("[cron] daily verse batch failed:", error.message);
    else sent += batch.length;
  }
  return NextResponse.json({ sent, birthdays });
}
