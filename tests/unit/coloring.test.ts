import { describe, expect, test } from "vitest";
import { COLORING_PALETTE, COLORING_PICTURES } from "@/lib/coloring/pictures";

describe("colouring pictures", () => {
  test("each picture has a unique key, a reference, and uniquely named closed shapes", () => {
    expect(new Set(COLORING_PICTURES.map((p) => p.key)).size).toBe(COLORING_PICTURES.length);
    for (const p of COLORING_PICTURES) {
      expect(p.reference).toMatch(/\d+:\d+/);
      expect(new Set(p.regions.map((r) => r.id)).size).toBe(p.regions.length);
      for (const r of p.regions) {
        expect(r.d.startsWith("M ")).toBe(true);
        expect(r.d.trim().endsWith("Z")).toBe(true);
        expect(r.d).not.toMatch(/NaN|undefined/);
      }
    }
  });
  test("the crayon box includes white to rub out", () => {
    expect(COLORING_PALETTE).toContain("#ffffff");
  });
});

import { floodFill, lineMask } from "@/lib/coloring/flood";

describe("tap to fill uploaded pages", () => {
  // A 10×10 white page with a black line down column 5.
  const w = 10;
  const h = 10;
  const page = () => {
    const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 0; y < h; y++) rgba.set([0, 0, 0, 255], (y * w + 5) * 4);
    return rgba;
  };
  test("fills up to the line and no further", () => {
    const rgba = page();
    const mask = lineMask(rgba, w, h);
    expect(floodFill(rgba, mask, w, h, 1, 1, () => [255, 0, 0])).toBe(50);
    expect([...rgba.slice((2 * w + 2) * 4, (2 * w + 2) * 4 + 3)]).toEqual([255, 0, 0]);
    expect([...rgba.slice((2 * w + 8) * 4, (2 * w + 8) * 4 + 3)]).toEqual([255, 255, 255]);
  });
  test("tapping a line fills nothing; refilling an area with a new colour works", () => {
    const rgba = page();
    const mask = lineMask(rgba, w, h);
    expect(floodFill(rgba, mask, w, h, 5, 3, () => [0, 0, 255])).toBe(0);
    floodFill(rgba, mask, w, h, 8, 8, () => [0, 255, 0]);
    expect(floodFill(rgba, mask, w, h, 8, 8, () => [0, 0, 255])).toBe(40);
  });
});
