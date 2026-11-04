import { describe, expect, test } from "vitest";
import { PALETTES, paletteCss } from "@/lib/church-colours";
import { monthBounds } from "@/lib/ai-allowance";

const lum = (rgb: string) => {
  const [r, g, b] = rgb.split(" ").map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const WHITE = "255 255 255";
const PARCHMENT = "253 247 248";
const DARK_SURFACE = "31 17 38";
const DARK_PANEL = "16 7 20";

describe("church colours", () => {
  for (const p of PALETTES) {
    test(`${p.label} stays readable (WCAG AA)`, () => {
      expect(contrast(p.light.ember, WHITE)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.light.ember, PARCHMENT)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.light.onEmber, p.light.ember)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.light.goldDeep, WHITE)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.dark.ember, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.dark.ember, DARK_PANEL)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.dark.onEmber, p.dark.ember)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.dark.goldDeep, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
    });
  }
  test("CSS only for a real palette", () => {
    expect(paletteCss(null)).toBe("");
    expect(paletteCss("nope")).toBe("");
    expect(paletteCss("royal")).toContain("--ember:30 64 175");
  });
});

describe("AI allowance month", () => {
  test("month bounds", () => {
    expect(monthBounds("2026-11-03")).toEqual({ start: "2026-11-01", nextMonth: "2026-12-01" });
    expect(monthBounds("2026-12-31")).toEqual({ start: "2026-12-01", nextMonth: "2027-01-01" });
  });
});
