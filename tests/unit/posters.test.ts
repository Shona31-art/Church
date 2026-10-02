import { describe, expect, test } from "vitest";
import { isPosterRole, normalizePosterStyle } from "@/lib/posters";

describe("normalizePosterStyle", () => {
  test("keeps valid stored values", () => {
    expect(normalizePosterStyle({ template_key: "bold", format: "story", theme_color: "#1e3a8a" })).toEqual({
      templateKey: "bold",
      format: "story",
      themeColor: "#1e3a8a",
    });
  });

  test("falls back instead of crashing on bad stored values", () => {
    expect(normalizePosterStyle({ template_key: "fancy", format: "billboard", theme_color: "url(https://x)" })).toEqual({
      templateKey: "classic",
      format: "square",
      themeColor: "#b45309",
    });
  });
});

describe("isPosterRole", () => {
  test("members can't make posters; leaders and up can", () => {
    expect(isPosterRole("member")).toBe(false);
    expect(isPosterRole(undefined)).toBe(false);
    expect(isPosterRole("department_leader")).toBe(true);
  });
});
