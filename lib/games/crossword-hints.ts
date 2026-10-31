import type { Level } from "./catalog";

/** Hint letters per crossword, by level (kept apart so the browser doesn't load the clue bank). */
export const CROSSWORD_HINTS: Record<Level, number> = { easy: 5, medium: 3, hard: 2 };
