// The games, their levels and how they score (pure — unit-tested).

export const GAME_KEYS = ["quiz", "word_search", "verse_puzzle"] as const;
export type GameKey = (typeof GAME_KEYS)[number];

export const LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export interface GameInfo {
  key: GameKey;
  title: string;
  /** One line for the games hub. */
  summary: string;
  /** Route segment under /dashboard/games. */
  path: string;
  /** What each level means, shown on the level picker. */
  levels: Record<Level, string>;
  /** A good time for "timed mode" bonus points, per level. */
  parSeconds: Record<Level, number>;
}

export const GAMES: Record<GameKey, GameInfo> = {
  quiz: {
    key: "quiz",
    title: "Bible quiz",
    summary: "Ten questions about the people, places and events of the Bible.",
    path: "quiz",
    levels: { easy: "Well-known stories", medium: "Details and names", hard: "Deeper knowledge" },
    parSeconds: { easy: 90, medium: 120, hard: 150 },
  },
  word_search: {
    key: "word_search",
    title: "Word search",
    summary: "Find Bible names and places hidden in the grid.",
    path: "word-search",
    levels: { easy: "8×8, across and down", medium: "12×12, plus diagonals", hard: "15×15, any direction — even backwards" },
    parSeconds: { easy: 120, medium: 240, hard: 360 },
  },
  verse_puzzle: {
    key: "verse_puzzle",
    title: "Verse puzzle",
    summary: "Put the words of well-known verses back in order.",
    path: "verse-puzzle",
    levels: { easy: "Three short verses", medium: "Five verses", hard: "Five longer verses" },
    parSeconds: { easy: 90, medium: 180, hard: 300 },
  },
};

/** Points for each correct answer — harder levels are worth more. */
const POINTS_PER_CORRECT: Record<Level, number> = { easy: 1, medium: 2, hard: 3 };

/**
 * Points for a finished game. Timed mode adds up to 50% for a perfect game
 * finished at or under par time (shrinking to nothing at twice par); an
 * untimed game is never penalised for being slow.
 */
export function pointsFor({ correct, max, level, timed, durationMs, parSeconds }: { correct: number; max: number; level: Level; timed: boolean; durationMs: number; parSeconds: number }): number {
  const base = correct * POINTS_PER_CORRECT[level];
  if (!timed || correct < max || max === 0) return base;
  const par = parSeconds * 1000;
  const speed = Math.max(0, Math.min(1, (2 * par - durationMs) / par)); // 1 at ≤ par, 0 at ≥ 2×par
  return base + Math.round(base * 0.5 * speed);
}

export function isGameKey(value: unknown): value is GameKey {
  return typeof value === "string" && (GAME_KEYS as readonly string[]).includes(value);
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}
