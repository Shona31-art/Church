import { describe, expect, test } from "vitest";
import { bestStars, highestUnlocked, stageLevel, stageSeed, starsFor } from "@/lib/games/stages";

describe("numbered levels", () => {
  test("1–30 easy, 31–65 medium, 66–100 hard", () => {
    expect([1, 30, 31, 65, 66, 100].map(stageLevel)).toEqual(["easy", "easy", "medium", "medium", "hard", "hard"]);
  });
  test("each level is always the same puzzle, and different from the next", () => {
    expect(stageSeed("quiz", 5)).toBe(stageSeed("quiz", 5));
    expect(stageSeed("quiz", 5)).not.toBe(stageSeed("quiz", 6));
    expect(stageSeed("quiz", 5)).not.toBe(stageSeed("crossword", 5));
  });
  test("stars: 70% passes, 90% two, perfect three", () => {
    expect([starsFor(6, 10), starsFor(7, 10), starsFor(9, 10), starsFor(10, 10), starsFor(0, 0)]).toEqual([0, 1, 2, 3, 0]);
  });
  test("passing unlocks the next level; best result counts", () => {
    const best = bestStars([
      { stage: 1, score: 10, total_questions: 10 },
      { stage: 2, score: 5, total_questions: 10 },
      { stage: 2, score: 8, total_questions: 10 },
      { stage: null, score: 10, total_questions: 10 },
    ]);
    expect(best).toEqual({ 1: 3, 2: 1 });
    expect(highestUnlocked(best)).toBe(3);
    expect(highestUnlocked({})).toBe(1);
  });
});
