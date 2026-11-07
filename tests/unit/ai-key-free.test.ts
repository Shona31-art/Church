import { describe, expect, test } from "vitest";
import { geminiFreeApiKey } from "@/lib/ai-key";

describe("free-tier Gemini key", () => {
  test("read from GEMINI_FREE_API_KEY, quotes and spaces trimmed; absent means none", () => {
    expect(geminiFreeApiKey({ GEMINI_FREE_API_KEY: ' "abc123" ' })).toBe("abc123");
    expect(geminiFreeApiKey({ GEMINI_API_KEY: "paid" })).toBeUndefined();
    expect(geminiFreeApiKey({ GEMINI_FREE_API_KEY: "  " })).toBeUndefined();
  });
});
