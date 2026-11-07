// Numbered levels 1–100 for every game (pure — unit-tested).
// 1–30 Easy, 31–65 Medium, 66–100 Hard. Each level is always the same puzzle
// (a fixed seed), so it's a real challenge you can come back to. Passing a
// level (70% or more) unlocks the next; stars show how well you did.

import type { GameKey, Level } from "./catalog";

export const STAGE_COUNT = 100;
export const PASS_RATIO = 0.7;

/** Kids mode has its own path of numbered levels (all kids' content, no clock). */
export const KIDS_STAGE_COUNT = 30;

export function isStage(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= STAGE_COUNT;
}

export function stageLevel(stage: number): Level {
  return stage <= 30 ? "easy" : stage <= 65 ? "medium" : "hard";
}

/** The same seed for a game's level, for everyone (FNV-1a). */
export function stageSeed(game: GameKey, stage: number): number {
  let hash = 0x811c9dc5;
  for (const ch of `stage:${game}:${stage}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 1;
}

/** 0 = not passed; 1 = passed (70%+); 2 = 90%+; 3 = perfect. */
export function starsFor(correct: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = correct / max;
  if (ratio >= 1) return 3;
  if (ratio >= 0.9) return 2;
  if (ratio >= PASS_RATIO) return 1;
  return 0;
}

/** Best stars per level from past games, e.g. {1: 3, 2: 1}. */
export function bestStars(attempts: readonly { stage: number | null; score: number | null; total_questions: number | null }[]): Record<number, number> {
  const best: Record<number, number> = {};
  for (const a of attempts) {
    if (!isStage(a.stage)) continue;
    const stars = starsFor(a.score ?? 0, a.total_questions ?? 0);
    best[a.stage] = Math.max(best[a.stage] ?? 0, stars);
  }
  return best;
}

/** The highest level you can play: 1, or one past the furthest level passed in a row. */
export function highestUnlocked(best: Record<number, number>, count = STAGE_COUNT): number {
  let stage = 1;
  while (stage < count && (best[stage] ?? 0) > 0) stage++;
  return stage;
}
