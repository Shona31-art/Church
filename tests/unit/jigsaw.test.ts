import { describe, expect, test } from "vitest";
import { JIGSAW_SIZE, buildJigsaw, checkJigsaw, fewestSwaps, scoreJigsawSwaps, swapPieces } from "@/lib/games/jigsaw";
import { createRng } from "@/lib/games/random";

describe("jigsaw", () => {
  test("builds a shuffled grid of the right size for each level", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      const p = buildJigsaw(level, createRng(42));
      expect(p.size).toBe(JIGSAW_SIZE[level]);
      expect([...p.order].sort((a, b) => a - b)).toEqual(Array.from({ length: p.size ** 2 }, (_, i) => i));
      expect(checkJigsaw(p, p.order)).toBeLessThan(p.size ** 2);
    }
  });

  test("scores pieces in their home slot; a solved puzzle scores every piece", () => {
    const p = buildJigsaw("easy", createRng(7));
    expect(checkJigsaw(p, Array.from({ length: 9 }, (_, i) => i))).toBe(9);
    expect(checkJigsaw(p, swapPieces([0, 1, 2, 3, 4, 5, 6, 7, 8], 0, 1))).toBe(7);
  });

  test("refuses arrangements that aren't real (cheating)", () => {
    const p = buildJigsaw("easy", createRng(7));
    expect(checkJigsaw(p, [0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(checkJigsaw(p, [0, 1, 2])).toBe(0);
    expect(checkJigsaw(p, [0, 1, 2, 3, 4, 5, 6, 7, 99])).toBe(0);
  });
});

describe("moves count", () => {
  const p = { scene: "ark" as const, size: 3, order: [1, 0, 2, 3, 4, 5, 6, 8, 7] };
  test("the fewest swaps is pieces minus cycles", () => {
    expect(fewestSwaps(p.order)).toBe(2);
  });
  test("solving in the fewest moves scores every piece", () => {
    expect(scoreJigsawSwaps(p, [[0, 1], [7, 8]])).toBe(9);
  });
  test("a few spare moves are free; many cost pieces, so a finished jigsaw can still fail", () => {
    const wasted: [number, number][] = [[2, 3], [2, 3]];
    expect(scoreJigsawSwaps(p, [...wasted, [0, 1], [7, 8]])).toBe(9);
    const lots: [number, number][] = Array.from({ length: 10 }, () => [2, 3] as [number, number]);
    expect(scoreJigsawSwaps(p, [...lots, [0, 1], [7, 8]])).toBe(5);
    expect(scoreJigsawSwaps(p, [[0, 99]])).toBe(0);
  });
});
