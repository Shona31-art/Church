import { describe, expect, test } from "vitest";
import { createRng } from "@/lib/games/random";
import { DIFFERENCE_LEVELS, DIFFERENCE_SCENES, PICTURE_HEIGHT, PICTURE_WIDTH, buildDifferences, checkDifferences, differenceSpots, markTaps } from "@/lib/games/differences";

describe("spot the difference: pictures", () => {
  test("every scene has a title, a Bible reference and objects inside the picture with unique ids", () => {
    for (const scene of DIFFERENCE_SCENES) {
      expect(scene.title.length).toBeGreaterThan(3);
      expect(scene.reference).toMatch(/\d/);
      expect(new Set(scene.objects.map((o) => o.id)).size).toBe(scene.objects.length);
      for (const o of scene.objects) {
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.x).toBeLessThanOrEqual(PICTURE_WIDTH);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeLessThanOrEqual(PICTURE_HEIGHT);
      }
    }
  });
});

describe("buildDifferences", () => {
  for (const level of ["easy", "medium", "hard"] as const) {
    test(`${level}: always the full number of differences, kept apart, and the pictures really differ there`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const p = buildDifferences(level, createRng(seed));
        expect(p.spots).toHaveLength(DIFFERENCE_LEVELS[level].count);
        expect(p.mistakes).toBe(DIFFERENCE_LEVELS[level].mistakes);
        // The spots can be worked out from the two pictures alone (what the board does).
        expect(differenceSpots(p.left, p.right)).toEqual(p.spots);
        // Spot centres are never inside another spot, so one tap means one difference.
        p.spots.forEach((a, i) =>
          p.spots.forEach((b, j) => {
            if (i !== j) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(Math.max(a.r, b.r) * 0.7);
          })
        );
      }
    });
  }

  test("is deterministic for a seed (numbered levels stay the same puzzle)", () => {
    expect(buildDifferences("hard", createRng(9))).toEqual(buildDifferences("hard", createRng(9)));
    expect(buildDifferences("hard", createRng(9))).not.toEqual(buildDifferences("hard", createRng(10)));
  });

  test("easy only removes or recolours things", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const s of buildDifferences("easy", createRng(seed)).spots) expect(s.label).toMatch(/missing|colour/);
    }
  });
});

describe("marking taps", () => {
  const p = buildDifferences("medium", createRng(4));
  const at = (i: number) => [p.spots[i].x, p.spots[i].y] as [number, number];

  test("tapping every difference finds them all", () => {
    expect(checkDifferences(p, p.spots.map((_, i) => at(i)))).toBe(p.spots.length);
  });

  test("tapping a found difference again is neither a find nor a mistake", () => {
    const r = markTaps(p.spots, [at(0), at(0), at(0)], p.mistakes);
    expect(r.found).toEqual([0]);
    expect(r.mistakes).toBe(0);
  });

  test("too many wrong taps ends the game: later finds don't count", () => {
    // Find a point that's outside every spot.
    let miss: [number, number] = [0, 0];
    outer: for (let x = 1; x < PICTURE_WIDTH; x += 3)
      for (let y = 1; y < PICTURE_HEIGHT; y += 3)
        if (p.spots.every((s) => Math.hypot(s.x - x, s.y - y) > s.r)) {
          miss = [x, y];
          break outer;
        }
    const taps = [at(0), ...Array(p.mistakes).fill(miss), at(1), at(2)];
    const r = markTaps(p.spots, taps, p.mistakes);
    expect(r.over).toBe(true);
    expect(r.found).toEqual([0]);
    expect(checkDifferences(p, taps)).toBe(1);
  });
});

describe("moved things", () => {
  test("stay wholly inside the picture", async () => {
    const { PROP_RADIUS } = await import("@/lib/games/differences");
    for (let seed = 1; seed <= 300; seed++) {
      const p = buildDifferences("hard", createRng(seed));
      for (const o of p.right) {
        const before = p.left.find((l) => l.id === o.id);
        if (before && before.x !== o.x) {
          const r = PROP_RADIUS[o.kind] * o.s;
          expect(o.x - r).toBeGreaterThanOrEqual(0);
          expect(o.x + r).toBeLessThanOrEqual(PICTURE_WIDTH);
        }
      }
    }
  });
});
