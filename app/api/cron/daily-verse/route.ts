import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { todayInAppZone } from "@/lib/format";
import { sendBirthdayGreetings } from "@/lib/birthdays-today";
import { sendDailyVerse } from "@/lib/daily-verse";

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
  const today = todayInAppZone();

  // Birthdays first (record_members.sql): notifications and a poster in General.
  let birthdays = { churches: 0, people: 0, posters: 0 };
  try {
    birthdays = await sendBirthdayGreetings(today);
  } catch (error) {
    console.error("[cron] birthdays failed:", (error as Error).message);
  }

  // Then the verse of the day (once a day per church, even if the job runs twice).
  const sent = await sendDailyVerse(today);
  return NextResponse.json({ sent, birthdays });
}
