"use server";

import { getCurrentAppUser } from "@/lib/current-user";
import { todayInAppZone } from "@/lib/format";
import { sendBirthdayGreetings } from "@/lib/birthdays-today";
import { sendDailyVerse } from "@/lib/daily-verse";

// Automatic catch-up for the morning: the 07:00 job (/api/cron/daily-verse)
// normally sends birthdays and the verse of the day. If it hasn't run for
// this church by the time anyone opens the app after 07:00, this sends them
// then. Each runs at most once per church per day, so it never doubles up
// with the job.
export async function catchUpMorning(): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return;
  const hour = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Johannesburg" }).format(new Date()));
  if (hour < 7) return;
  try {
    await sendBirthdayGreetings(todayInAppZone(), me.church_id);
  } catch (error) {
    console.error("[birthdays] catch-up failed:", (error as Error).message);
  }
  try {
    await sendDailyVerse(todayInAppZone(), me.church_id);
  } catch (error) {
    console.error("[daily verse] catch-up failed:", (error as Error).message);
  }
}
