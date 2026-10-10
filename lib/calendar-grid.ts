// Month-grid date maths for the calendar page (pure — unit-tested).
//
// Every "day" here is a calendar date in the church's timezone as YYYY-MM-DD,
// never a JS Date, so the grid can't drift a day when the server runs in UTC.

import { APP_TIMEZONE, localInputToUtcIso } from "@/lib/format";

export interface YearMonth {
  year: number;
  month: number; // 1–12
}

export interface GridDay {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10" → { year: 2026, month: 10 }; anything invalid falls back to today's month. */
export function parseMonth(value: string | undefined, today: string): YearMonth {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) return { year, month };
  }
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${pad(month)}`;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * UTC instants bounding the month in the church's timezone: [start, end).
 * Used to fetch only the events that can appear in the grid.
 */
export function monthRangeUtc(ym: YearMonth, timeZone: string = APP_TIMEZONE): { start: string; end: string } {
  const next = shiftMonth(ym, 1);
  return {
    start: localInputToUtcIso(`${monthKey(ym)}-01T00:00`, timeZone)!,
    end: localInputToUtcIso(`${monthKey(next)}-01T00:00`, timeZone)!,
  };
}

/**
 * Whole weeks (Sunday first — the week a church plans around) covering the
 * month, padded with the trailing/leading days of the neighbouring months.
 */
export function buildMonthGrid(ym: YearMonth): GridDay[][] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1));
  const daysInMonth = new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
  const cells = Math.ceil((first.getUTCDay() + daysInMonth) / 7) * 7;
  const cursor = new Date(first.getTime() - first.getUTCDay() * 86_400_000);

  const weeks: GridDay[][] = [];
  for (let i = 0; i < cells; i++) {
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      date: cursor.toISOString().slice(0, 10),
      inMonth: cursor.getUTCMonth() === ym.month - 1,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return weeks;
}

/** The calendar date (in the church's timezone) an instant falls on. */
export function dayInZone(iso: string, timeZone: string = APP_TIMEZONE): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone }); // en-CA formats as YYYY-MM-DD
}

/**
 * Every calendar day an event covers, so a weekend camp shows on Fri, Sat and
 * Sun. Capped at 31 days so a mistyped end date can't flood the grid.
 */
export function eventDays(startIso: string, endIso: string | null, timeZone: string = APP_TIMEZONE): string[] {
  const first = dayInZone(startIso, timeZone);
  const last = endIso ? dayInZone(endIso, timeZone) : first;
  const days = [first];
  const cursor = new Date(`${first}T12:00:00Z`);
  while (days.length < 31) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const next = cursor.toISOString().slice(0, 10);
    if (next > last) break;
    days.push(next);
  }
  return days;
}
