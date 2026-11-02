// Daily challenge, streaks and badges (pure — unit-tested).

import type { GameKey } from "./catalog";

// ---------------------------------------------------------------------------
// Daily challenge: one game a day, the same puzzle for the whole church.
// ---------------------------------------------------------------------------

export const DAILY_ROTATION: GameKey[] = ["crossword", "quiz", "word_search", "emoji", "verse_puzzle", "maze", "who_said", "scramble", "books_order", "verse_fill", "jigsaw", "differences"];

/** Today's game for a calendar day (YYYY-MM-DD). */
export function dailyGame(day: string): GameKey {
  const days = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  return DAILY_ROTATION[((days % DAILY_ROTATION.length) + DAILY_ROTATION.length) % DAILY_ROTATION.length];
}

/** Same seed for everyone in a church on a given day (FNV-1a hash). */
export function dailySeed(churchId: string, day: string): number {
  let hash = 0x811c9dc5;
  for (const ch of `${churchId}:${day}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 1;
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/**
 * Consecutive days played, counting back from today — or from yesterday if
 * you haven't played yet today (so a streak doesn't vanish at midnight).
 */
export function currentStreak(daysPlayed: Iterable<string>, today: string): number {
  const days = new Set(daysPlayed);
  let day = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = previousDay(day);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export const BADGES = {
  first_game: { title: "First steps", description: "Finished your first game" },
  explorer: { title: "Explorer", description: "Played eight different games" },
  crossword_scholar: { title: "Crossword scholar", description: "Finished five crosswords" },
  hard_perfect: { title: "Deep diver", description: "A perfect game on Hard" },
  quick_and_sure: { title: "Quick and sure", description: "A perfect timed game within the target time on Medium or Hard" },
  streak_7: { title: "Faithful week", description: "Played seven days in a row" },
  streak_30: { title: "Faithful month", description: "Played thirty days in a row" },
  daily_7: { title: "Daily devotee", description: "Completed seven daily challenges" },
  games_50: { title: "Well read", description: "Finished fifty games" },
} as const;
export type BadgeKey = keyof typeof BADGES;

export interface PlayerStats {
  totalGames: number;
  gameTypes: Set<string>;
  crosswords: number;
  dailyChallenges: number;
  streak: number;
  /** The game just finished. */
  last: { level: string; correct: number; max: number; timed: boolean; durationMs: number; parSeconds: number };
}

/** Every badge these stats qualify for (already-earned ones are filtered out by the caller). */
export function earnedBadges(stats: PlayerStats): BadgeKey[] {
  const { last } = stats;
  const perfect = last.max > 0 && last.correct === last.max;
  const rules: Record<BadgeKey, boolean> = {
    first_game: stats.totalGames >= 1,
    explorer: stats.gameTypes.size >= 8,
    crossword_scholar: stats.crosswords >= 5,
    hard_perfect: perfect && last.level === "hard",
    quick_and_sure: perfect && last.timed && last.level !== "easy" && last.durationMs <= last.parSeconds * 1000,
    streak_7: stats.streak >= 7,
    streak_30: stats.streak >= 30,
    daily_7: stats.dailyChallenges >= 7,
    games_50: stats.totalGames >= 50,
  };
  return (Object.keys(rules) as BadgeKey[]).filter((k) => rules[k]);
}
