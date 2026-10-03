// Date, time and money formatting in ONE timezone and locale.
//
// Why: pages render on the server, and Vercel's servers run in UTC. Plain
// toLocaleString() there shows a 09:00 service as 07:00 for a South African
// church. Everything that shows or reads a wall-clock time goes through here.
//
// Assumption (documented in README): one timezone per deployment, set with
// NEXT_PUBLIC_APP_TIMEZONE (default Africa/Johannesburg). Per-church
// timezones would need a churches.timezone column.

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Africa/Johannesburg";
const LOCALE = "en-ZA";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  // A bare YYYY-MM-DD is a calendar date, not an instant: pin it to midday UTC
  // so no timezone can push it onto the previous or next day.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Sun, 5 Oct 2026" */
export function formatDate(value: DateInput, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, { timeZone: APP_TIMEZONE, weekday: "short", day: "numeric", month: "short", year: "numeric", ...opts });
}

/** "Sun, 5 Oct, 09:00" */
export function formatDateTime(value: DateInput, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString(LOCALE, {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...opts,
  });
}

/** "09:00" */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString(LOCALE, { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Today's calendar date in the church's timezone, as YYYY-MM-DD. */
export function todayInAppZone(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE }); // en-CA formats as YYYY-MM-DD
}

/** Minutes the timezone is ahead of UTC at the given instant (DST-aware). */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * Converts a <input type="datetime-local"> value ("2026-10-05T09:00"), which
 * means wall-clock time in the church's timezone, into a UTC ISO string for
 * the database. Returns null for anything that isn't a valid local datetime.
 */
export function localInputToUtcIso(local: string, timeZone: string = APP_TIMEZONE): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (guess.getUTCMonth() !== mo - 1 || guess.getUTCDate() !== d) return null; // e.g. 31 Feb
  const utc = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60_000);
  return utc.toISOString();
}

/** The reverse: a stored UTC instant as a datetime-local value for an edit form. */
export function utcIsoToLocalInput(iso: string | null | undefined, timeZone: string = APP_TIMEZONE): string {
  const d = toDate(iso);
  if (!d) return "";
  const shifted = new Date(d.getTime() + offsetMinutes(d, timeZone) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** Cents → "R 1 250,00" (South African formatting). */
export function formatMoney(cents: number, currency = "ZAR"): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format((cents ?? 0) / 100);
}

/** "3 days ago" style relative time for activity feeds. */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return "—";
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86_400) return rtf.format(Math.round(seconds / 86_400), "day");
  return formatDate(d);
}
