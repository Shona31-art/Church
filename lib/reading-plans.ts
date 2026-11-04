// Bible reading plans (church_life.sql). Plans are stored as a list of days,
// each with its chapters, so a plan never changes under people once started.
import { BOOKS, bookIndexByName } from "@/lib/bible/books";

export interface Reading {
  book: string;
  chapter: number;
}
export interface PlanDay {
  readings: Reading[];
}

export interface Preset {
  key: string;
  title: string;
  description: string;
  from: string;
  to: string;
  perDay: number;
}

/** Ready-made plans: whole books (or runs of books), a set number of chapters a day. */
export const PRESETS: readonly Preset[] = [
  { key: "john", title: "The Gospel of John", description: "Meet Jesus in 21 days — a chapter a day.", from: "John", to: "John", perDay: 1 },
  { key: "mark", title: "The Gospel of Mark", description: "The fast-moving gospel in 16 days.", from: "Mark", to: "Mark", perDay: 1 },
  { key: "acts", title: "Acts", description: "The early church in 28 days.", from: "Acts", to: "Acts", perDay: 1 },
  { key: "romans", title: "Romans", description: "The gospel explained, in 16 days.", from: "Romans", to: "Romans", perDay: 1 },
  { key: "proverbs", title: "Proverbs in a month", description: "A chapter of wisdom for each day of the month.", from: "Proverbs", to: "Proverbs", perDay: 1 },
  { key: "psalms", title: "Psalms in 30 days", description: "Five psalms a day.", from: "Psalms", to: "Psalms", perDay: 5 },
  { key: "gospels", title: "The four Gospels", description: "Matthew to John in 89 days.", from: "Matthew", to: "John", perDay: 1 },
  { key: "nt", title: "New Testament in a year", description: "Matthew to Revelation, a chapter a day (260 days).", from: "Matthew", to: "Revelation", perDay: 1 },
  { key: "genesis", title: "Genesis", description: "Beginnings, in 50 days.", from: "Genesis", to: "Genesis", perDay: 1 },
];

/** Every chapter from one book to another (inclusive), split into days. */
export function buildDays(from: string, to: string, perDay: number): PlanDay[] {
  const a = bookIndexByName(from);
  const b = bookIndexByName(to);
  if (a < 0 || b < a || perDay < 1 || perDay > 10) return [];
  const chapters: Reading[] = [];
  for (let i = a; i <= b; i++) for (let c = 1; c <= BOOKS[i].chapters; c++) chapters.push({ book: BOOKS[i].name, chapter: c });
  const days: PlanDay[] = [];
  for (let i = 0; i < chapters.length; i += perDay) days.push({ readings: chapters.slice(i, i + perDay) });
  return days;
}

/** "John 3" · "Psalms 1–5" · "John 21, Acts 1" */
export function readingLabel(readings: readonly Reading[]): string {
  const groups: { book: string; first: number; last: number }[] = [];
  for (const r of readings) {
    const g = groups[groups.length - 1];
    if (g && g.book === r.book && r.chapter === g.last + 1) g.last = r.chapter;
    else groups.push({ book: r.book, first: r.chapter, last: r.chapter });
  }
  return groups.map((g) => (g.first === g.last ? `${g.book} ${g.first}` : `${g.book} ${g.first}–${g.last}`)).join(", ");
}

const dayMs = 86_400_000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / dayMs);

/** Which day of the plan today is (1 = the start date); may be < 1 or > length. */
export const planDayNumber = (startDate: string, today: string) => toDay(today) - toDay(startDate) + 1;

/**
 * Reading streak: consecutive calendar days (in the church's time zone) with
 * at least one day ticked, ending today — or yesterday, so it isn't "lost"
 * before you've had the chance to read today.
 */
export function streak(doneDates: readonly string[], today: string): number {
  const set = new Set(doneDates.map(toDay));
  let d = toDay(today);
  if (!set.has(d)) d -= 1;
  let n = 0;
  while (set.has(d)) {
    n++;
    d--;
  }
  return n;
}
