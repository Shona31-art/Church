import { describe, expect, test, vi } from "vitest";

// lib/bible/text.ts is server-only (it reads files); the marker package throws outside Next's server build.
vi.mock("server-only", () => ({}));
const { fetchVerse } = await import("@/lib/bible/text");
const { DAILY_VERSE_REFS } = await import("@/lib/bible");

describe("server-side verse text (daily verse, AI study)", () => {
  test("single verses, ranges and whole chapters, without supplied-word brackets", async () => {
    expect(await fetchVerse("John 3:16")).toMatch(/^For God so loved the world/);
    const range = await fetchVerse("Proverbs 3:5-6");
    expect(range).toMatch(/Trust in Yahweh/);
    expect(range).toMatch(/paths straight/);
    expect((await fetchVerse("Psalm 117"))!.length).toBeGreaterThan(50);
    expect(await fetchVerse("Psalm 23:1", "asv")).not.toMatch(/[[\]]/);
  });

  test("every daily verse resolves to text", async () => {
    for (const ref of DAILY_VERSE_REFS) expect(await fetchVerse(ref), ref).toBeTruthy();
  });

  test("unknown references give null rather than throwing", async () => {
    expect(await fetchVerse("Hezekiah 1:1")).toBeNull();
    expect(await fetchVerse("John 3:99")).toBeNull();
    expect(await fetchVerse("forgiveness")).toBeNull();
  });
});
