"use client";

import { useEffect } from "react";
import { catchUpMorning } from "@/app/dashboard/birthday-actions";

/**
 * Invisible: once a day per device, asks the server to make sure today's
 * birthdays and verse of the day have gone out (in case the 07:00 job didn't run). The server
 * does nothing if they already have.
 */
export function BirthdayCatchUp() {
  useEffect(() => {
    const key = "grace-birthday-check";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
    const hour = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Johannesburg" }).format(new Date()));
    if (hour < 7) return;
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      /* private mode: just check */
    }
    catchUpMorning().catch(() => undefined);
  }, []);
  return null;
}
