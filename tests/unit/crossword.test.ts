import { describe, expect, test } from "vitest";
import { CROSSWORD_LEVELS, buildCrossword, checkCrossword, entryCells, type CrosswordPuzzle } from "@/lib/games/crossword";
import { CROSSWORD_CLUES } from "@/lib/games/content/crossword-clues";

/** The solved grid as row strings ("." for blocks). */
function solution(p: CrosswordPuzzle): string[] {
  const grid = Array.from({ length: p.height }, () => Array(p.width).fill("."));
  for (const e of p.entries) entryCells(e, e.answer.length).forEach(([r, c], i) => (grid[r][c] = e.answer[i]));
  return grid.map((r) => r.join(""));
}

describe("clue bank", () => {
  test("answers are capital letters only, each has a clue and reference, no duplicates", () => {
    for (const c of CROSSWORD_CLUES) {
      expect(c.answer).toMatch(/^[A-Z]{3,}$/);
      expect(c.clue.length).toBeGreaterThan(5);
      expect(c.reference).toMatch(/\d/);
    }
    expect(new Set(CROSSWORD_CLUES.map((c) => c.answer)).size).toBe(CROSSWORD_CLUES.length);
  });
});

describe("buildCrossword", () => {
  test("is deterministic for a seed and varies between seeds", () => {
    expect(buildCrossword("medium", 123)).toEqual(buildCrossword("medium", 123));
    expect(buildCrossword("medium", 123)).not.toEqual(buildCrossword("medium", 124));
  });

  for (const level of ["easy", "medium", "hard"] as const) {
    test(`${level}: fills (nearly) the target, letters agree where words cross, and no stray words appear`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const p = buildCrossword(level, seed);
        expect(p.entries.length).toBeGreaterThanOrEqual(Math.ceil(CROSSWORD_LEVELS[level].target * 0.8));

        // Crossing letters agree (writing every answer into one grid never conflicts).
        const grid = Array.from({ length: p.height }, () => Array<string>(p.width).fill("."));
        for (const e of p.entries) {
          entryCells(e, e.answer.length).forEach(([r, c], i) => {
            expect([".", e.answer[i]]).toContain(grid[r][c]);
            grid[r][c] = e.answer[i];
          });
        }

        // Every run of 2+ letters across or down is exactly one of the entries.
        const runs: string[] = [];
        const rows = grid.map((r) => r.join(""));
        const cols = Array.from({ length: p.width }, (_, c) => rows.map((r) => r[c]).join(""));
        for (const line of [...rows, ...cols]) runs.push(...line.split(".").filter((s) => s.length > 1));
        expect(runs.sort()).toEqual(p.entries.map((e) => e.answer).sort());

        // Numbers run 1..n in reading order.
        const numbers = [...new Set(p.entries.map((e) => e.number))].sort((a, b) => a - b);
        expect(numbers).toEqual(numbers.map((_, i) => i + 1));
      }
    });
  }
});

describe("checkCrossword", () => {
  test("counts fully correct entries, case-insensitively", () => {
    const p = buildCrossword("easy", 5);
    const solved = solution(p);
    expect(checkCrossword(p, solved)).toBe(p.entries.length);
    expect(checkCrossword(p, solved.map((r) => r.toLowerCase()))).toBe(p.entries.length);
    expect(checkCrossword(p, [])).toBe(0);

    // Blank out one entry's first letter: that entry (and any crossing it there) fails.
    const first = p.entries[0];
    const broken = solved.map((r) => r.split(""));
    broken[first.row][first.col] = " ";
    expect(checkCrossword(p, broken.map((r) => r.join("")))).toBeLessThan(p.entries.length);
  });
});

describe("crossword hints", () => {
  test("give the right letter for a square, and nothing outside the puzzle", async () => {
    const { buildCrossword, crosswordLetterAt, entryCells, CROSSWORD_HINTS } = await import("@/lib/games/crossword");
    const puzzle = buildCrossword("easy", 3);
    const e = puzzle.entries[0];
    const cells = entryCells(e, e.answer.length);
    cells.forEach(([r, c], i) => expect(crosswordLetterAt(puzzle, r, c)).toBe(e.answer[i].toUpperCase()));
    expect(crosswordLetterAt(puzzle, -1, -1)).toBeNull();
    expect(CROSSWORD_HINTS.easy).toBeGreaterThan(CROSSWORD_HINTS.hard);
  });
});
