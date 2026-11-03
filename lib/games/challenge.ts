// Whole-church Bible challenge rules (pure — unit-tested). See supabase/church_challenges.sql.

/** How long a challenge stays open, as offered to the pastor. */
export const CHALLENGE_DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
] as const;

export interface ChallengeEntry {
  user_id: string;
  score: number;
  ms: number;
  done: number;
  finished_at: string | null;
}

/**
 * The leaderboard: finished players by most right answers, then quickest;
 * equal score and time share a place. Those still playing come last, unranked.
 */
export function rankEntries<T extends ChallengeEntry>(entries: T[]): (T & { rank: number | null })[] {
  const finished = entries.filter((e) => e.finished_at).sort((a, b) => b.score - a.score || a.ms - b.ms || a.user_id.localeCompare(b.user_id));
  const playing = entries.filter((e) => !e.finished_at).sort((a, b) => b.done - a.done);
  let rank = 0;
  const ranked = finished.map((e, i) => {
    const prev = finished[i - 1];
    if (!prev || prev.score !== e.score || prev.ms !== e.ms) rank = i + 1;
    return { ...e, rank };
  });
  return [...ranked, ...playing.map((e) => ({ ...e, rank: null }))];
}

export type ChallengeState = "upcoming" | "open" | "closed";

export function challengeState(c: { starts_at: string; ends_at: string }, now: Date = new Date()): ChallengeState {
  if (now.getTime() < new Date(c.starts_at).getTime()) return "upcoming";
  return now.getTime() < new Date(c.ends_at).getTime() ? "open" : "closed";
}

/** "Closes in 2 h 15 min", "Closes in 3 days" */
export function closesIn(endsAt: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((new Date(endsAt).getTime() - now.getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  if (mins < 48 * 60) return `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
  return `${Math.round(mins / 1440)} days`;
}

/** 1st, 2nd, 3rd, 11th, 22nd… */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}
