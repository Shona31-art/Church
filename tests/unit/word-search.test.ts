import { describe, expect, test } from "vitest";

describe("drag to select", () => {
  test("snaps a wobbly drag to the nearest straight line, inside the grid", async () => {
    const { snapToLine, cellsBetween } = await import("@/lib/games/word-search");
    expect(snapToLine([0, 0], [0, 4], 8)).toEqual([0, 4]); // across
    expect(snapToLine([0, 0], [1, 4], 8)).toEqual([0, 4]); // slightly off: still across
    expect(snapToLine([0, 0], [3, 4], 8)).toEqual([4, 4]); // nearer diagonal
    expect(snapToLine([2, 2], [2, 2], 8)).toEqual([2, 2]);
    expect(snapToLine([6, 6], [9, 9], 8)).toEqual([7, 7]); // clamped to the grid
    expect(cellsBetween([0, 0], [0, 3])).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
  });
});
