import { describe, expect, test } from "vitest";
import { pieceEdges, piecePath } from "@/lib/games/jigsaw-shape";

describe("jigsaw piece shapes", () => {
  test("outside edges are straight; neighbours always fit (tab meets hole)", () => {
    const n = 4;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const e = pieceEdges(r, c, n);
        if (r === 0) expect(e.top).toBe(0);
        if (c === 0) expect(e.left).toBe(0);
        if (r === n - 1) expect(e.bottom).toBe(0);
        if (c === n - 1) expect(e.right).toBe(0);
        if (c < n - 1) expect(e.right).toBe(-pieceEdges(r, c + 1, n).left);
        if (r < n - 1) expect(e.bottom).toBe(-pieceEdges(r + 1, c, n).top);
        if (c < n - 1) expect(Math.abs(e.right)).toBe(1);
      }
  });

  test("outlines are closed paths with curves on inside edges only", () => {
    expect(piecePath(0, 0, 1)).toBe("M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z");
    const middle = piecePath(1, 1, 3);
    expect(middle.startsWith("M 0 0")).toBe(true);
    expect(middle.endsWith("Z")).toBe(true);
    expect((middle.match(/C /g) ?? []).length).toBe(12);
  });
});
