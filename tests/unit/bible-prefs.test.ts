import { describe, expect, test } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "@/lib/bible/reader-prefs";

describe("sanitizeSettings", () => {
  test("keeps valid saved settings", () => {
    const saved = { textSize: "xlarge", lineSpacing: "relaxed", font: "serif", layout: "paragraph", compareWith: "kjv" };
    expect(sanitizeSettings(saved)).toEqual(saved);
  });

  test("falls back to defaults for missing, unknown or tampered values", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ textSize: "huge", font: 3, layout: "<script>", compareWith: 42 })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ textSize: "large" })).toEqual({ ...DEFAULT_SETTINGS, textSize: "large" });
  });
});
