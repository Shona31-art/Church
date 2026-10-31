// The games, their levels and how they score (pure — unit-tested).

export const GAME_KEYS = ["quiz", "crossword", "word_search", "emoji", "scramble", "verse_puzzle", "verse_fill", "who_said", "books_order", "maze", "jigsaw"] as const;
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
  crossword: {
    key: "crossword",
    title: "Crossword",
    summary: "Bible people, places and books — a fresh grid every game.",
    path: "crossword",
    levels: { easy: "6 well-known words", medium: "9 words, more names and places", hard: "12 words for keen readers" },
    parSeconds: { easy: 240, medium: 420, hard: 600 },
  },
  word_search: {
    key: "word_search",
    title: "Word search",
    summary: "Find Bible names and places hidden in the grid.",
    path: "word-search",
    levels: { easy: "8×8, across and down", medium: "12×12, plus diagonals", hard: "15×15, any direction — even backwards" },
    parSeconds: { easy: 120, medium: 240, hard: 360 },
  },
  emoji: {
    key: "emoji",
    title: "Emoji stories",
    summary: "Guess the Bible story from a row of emoji.",
    path: "emoji",
    levels: { easy: "Famous stories, four choices", medium: "More stories, four choices", hard: "Lesser-known — type your answer" },
    parSeconds: { easy: 90, medium: 120, hard: 180 },
  },
  scramble: {
    key: "scramble",
    title: "Word scramble",
    summary: "Unscramble the letters to find Bible names, places and words.",
    path: "scramble",
    levels: { easy: "5 words, with clues", medium: "8 words, with clues", hard: "10 words, first-letter hints only" },
    parSeconds: { easy: 90, medium: 180, hard: 300 },
  },
  verse_fill: {
    key: "verse_fill",
    title: "Fill in the verse",
    summary: "Find the missing words in well-known verses.",
    path: "verse-fill",
    levels: { easy: "One missing word, four choices", medium: "Two missing words, four choices", hard: "Two missing words — type them" },
    parSeconds: { easy: 90, medium: 120, hard: 180 },
  },
  who_said: {
    key: "who_said",
    title: "Who said it?",
    summary: "Match famous Bible sayings to the people who said them.",
    path: "who-said",
    levels: { easy: "Well-known sayings", medium: "From the whole Bible", hard: "Harder to place" },
    parSeconds: { easy: 90, medium: 120, hard: 150 },
  },
  books_order: {
    key: "books_order",
    title: "Books in order",
    summary: "Put the books of the Bible back in their order.",
    path: "books",
    levels: { easy: "Five books in a row", medium: "Eight books in a row", hard: "A whole section of the Bible" },
    parSeconds: { easy: 60, medium: 120, hard: 180 },
  },
  maze: {
    key: "maze",
    title: "Bible maze",
    summary: "Find the way through — lead the shepherd to the lost sheep and more.",
    path: "maze",
    levels: { easy: "Small maze", medium: "Medium maze", hard: "Large maze" },
    parSeconds: { easy: 45, medium: 90, hard: 180 },
  },
  verse_puzzle: {
    key: "verse_puzzle",
    title: "Verse puzzle",
    summary: "Put the words of well-known verses back in order.",
    path: "verse-puzzle",
    levels: { easy: "Three short verses", medium: "Five verses", hard: "Five longer verses" },
    parSeconds: { easy: 90, medium: 180, hard: 300 },
  },
  jigsaw: {
    key: "jigsaw",
    title: "Bible jigsaw",
    summary: "Put a Bible picture back together, piece by piece.",
    path: "jigsaw",
    levels: { easy: "9 pieces", medium: "16 pieces", hard: "25 pieces" },
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
