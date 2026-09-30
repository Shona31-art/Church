// Pure date logic for birthday reminders (ported from the Android app's
// BirthdayAlertService). Kept free of Supabase/React so it's unit-tested.

export interface BirthdayInput {
  userId: string;
  name: string;
  birthDate: string; // ISO "YYYY-MM-DD"
}

export interface UpcomingBirthday extends BirthdayInput {
  daysUntil: number; // 0 = today
  turningAge: number;
  nextDate: string; // ISO date of the upcoming birthday
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Birthday date in a given year — Feb 29 birthdays fall on Feb 28 in non-leap years. */
function birthdayInYear(m: number, d: number, year: number): Date {
  const day = m === 2 && d === 29 && !isLeapYear(year) ? 28 : d;
  return new Date(Date.UTC(year, m - 1, day));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Birthdays falling within the next `windowDays` days (inclusive of today),
 * soonest first. `today` is passed in (not read from the clock) so the result
 * is deterministic and testable; callers pass the church's local date.
 */
export function upcomingBirthdays(
  people: BirthdayInput[],
  today: Date,
  windowDays = 7
): UpcomingBirthday[] {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const year = today.getFullYear();
  const results: UpcomingBirthday[] = [];

  for (const person of people) {
    const parsed = parseIsoDate(person.birthDate);
    if (!parsed) continue;

    let next = birthdayInYear(parsed.m, parsed.d, year);
    if (next.getTime() < todayUtc) next = birthdayInYear(parsed.m, parsed.d, year + 1);

    const daysUntil = Math.round((next.getTime() - todayUtc) / MS_PER_DAY);
    if (daysUntil > windowDays) continue;

    results.push({
      ...person,
      daysUntil,
      turningAge: next.getUTCFullYear() - parsed.y,
      nextDate: next.toISOString().slice(0, 10),
    });
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

export function describeDaysUntil(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}
