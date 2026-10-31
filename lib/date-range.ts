// Day-by-day helpers for "away from … until …" (pastor availability).
// Dates are plain YYYY-MM-DD strings, worked out in UTC so time zones and
// daylight saving can't shift a day.

export const MAX_AWAY_DAYS = 120;

function toUtc(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Every date from `start` to `end`, both included. Empty if end is before start. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = toUtc(start); t <= toUtc(end); t += 86_400_000) out.push(fromUtc(t));
  return out;
}

export function nextDay(day: string) {
  return fromUtc(toUtc(day) + 86_400_000);
}

export interface DayRow {
  id: string;
  date: string;
  /** Rows only join a range when this matches, e.g. same pastor and note. */
  key: string;
}

export interface DayRange<T extends DayRow> {
  start: string;
  end: string;
  rows: T[];
}

/** Joins rows on back-to-back days with the same key into ranges, in date order. */
export function groupConsecutiveDays<T extends DayRow>(rows: T[]): DayRange<T>[] {
  const sorted = [...rows].sort((a, b) => a.key.localeCompare(b.key) || a.date.localeCompare(b.date));
  const ranges: DayRange<T>[] = [];
  for (const row of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.rows[0].key === row.key && (row.date === last.end || row.date === nextDay(last.end))) {
      last.end = row.date;
      last.rows.push(row);
    } else {
      ranges.push({ start: row.date, end: row.date, rows: [row] });
    }
  }
  return ranges.sort((a, b) => a.start.localeCompare(b.start));
}
