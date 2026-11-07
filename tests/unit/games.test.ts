import { describe, expect, test } from "vitest";
import { createRng, shuffle } from "@/lib/games/random";
import { pointsFor } from "@/lib/games/catalog";
import { WORD_SEARCH_LEVELS, buildWordSearch, checkWordSearch, lettersBetween } from "@/lib/games/word-search";
import { checkQuiz } from "@/lib/games/quiz";
import { countSolvedVerses, pickRoundForLevel, tokenize } from "@/lib/verse-puzzle";

describe("seeded randomness", () => {
  test("the same seed gives the same sequence and the same puzzle", () => {
    expect(shuffle([1, 2, 3, 4, 5, 6], createRng(42))).toEqual(shuffle([1, 2, 3, 4, 5, 6], createRng(42)));
    expect(buildWordSearch("hard", createRng(7))).toEqual(buildWordSearch("hard", createRng(7)));
    expect(buildWordSearch("hard", createRng(7)).grid).not.toEqual(buildWordSearch("hard", createRng(8)).grid);
  });
});

describe("word search levels", () => {
  test("sizes and word counts per level; easy only reads across or down", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      const puzzle = buildWordSearch(level, createRng(3));
      expect(puzzle.size).toBe(WORD_SEARCH_LEVELS[level].size);
      expect(puzzle.words.length).toBe(WORD_SEARCH_LEVELS[level].words);
    }
    for (const w of buildWordSearch("easy", createRng(11)).words) {
      expect(w.end[0] >= w.start[0] && w.end[1] >= w.start[1] && (w.start[0] === w.end[0] || w.start[1] === w.end[1])).toBe(true);
    }
  });

  test("a marked line counts if its letters spell the word, either way round", () => {
    const puzzle = buildWordSearch("medium", createRng(5));
    const [w] = puzzle.words;
    expect(checkWordSearch(puzzle, [{ word: w.word, start: w.start, end: w.end }])).toBe(1);
    expect(checkWordSearch(puzzle, [{ word: w.word, start: w.end, end: w.start }])).toBe(1);
    // Marking the same word twice still counts once; a wrong line doesn't count.
    expect(checkWordSearch(puzzle, [{ word: w.word, start: w.start, end: w.end }, { word: w.word, start: w.start, end: w.end }])).toBe(1);
    expect(checkWordSearch(puzzle, [{ word: w.word, start: [0, 0], end: [0, 1] }])).toBe(0);
  });

  test("off-grid or crooked lines are refused safely", () => {
    const { grid } = buildWordSearch("easy", createRng(1));
    expect(lettersBetween(grid, [0, 0], [999999999, 0])).toBeNull();
    expect(lettersBetween(grid, [0, 0], [1, 3])).toBeNull();
  });
});

describe("quiz marking", () => {
  test("only locked-in choices that match the key count", () => {
    expect(checkQuiz({ ids: ["a", "b", "c"], correct: [0, 2, 1] }, { "0": 0, "1": 1 })).toBe(1);
  });
});

describe("verse puzzle levels", () => {
  test("easy picks three short verses; hard picks long ones", () => {
    const easy = pickRoundForLevel("easy", createRng(9));
    expect(easy).toHaveLength(3);
    expect(easy.every((v) => tokenize(v.text).length <= 9)).toBe(true);
    expect(pickRoundForLevel("hard", createRng(9)).every((v) => tokenize(v.text).length >= 10)).toBe(true);
  });

  test("revealed verses score nothing", () => {
    expect(countSolvedVerses(3, { "0": { tries: 1, solved: true }, "1": { tries: 2, solved: true, revealed: true }, "2": { tries: 5 } })).toBe(1);
  });
});

describe("points", () => {
  const base = { correct: 10, max: 10, level: "medium" as const, parSeconds: 100 };
  test("harder levels are worth more per answer", () => {
    expect(pointsFor({ ...base, level: "easy", timed: false, durationMs: 0 })).toBe(10);
    expect(pointsFor({ ...base, level: "hard", timed: false, durationMs: 0 })).toBe(30);
  });
  test("timed bonus: +50% at par, shrinking to nothing at twice par, in proportion to what you got right", () => {
    expect(pointsFor({ ...base, timed: true, durationMs: 90_000 })).toBe(30);
    expect(pointsFor({ ...base, timed: true, durationMs: 150_000 })).toBe(25);
    expect(pointsFor({ ...base, timed: true, durationMs: 250_000 })).toBe(20);
    // One wrong (9 of 10 on Medium): 18 + 9 bonus, not 18 with no bonus.
    expect(pointsFor({ ...base, correct: 9, timed: true, durationMs: 1_000 })).toBe(27);
    expect(pointsFor({ ...base, correct: 0, timed: true, durationMs: 1_000 })).toBe(0);
  });
});
