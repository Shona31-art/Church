import { describe, expect, test } from "vitest";
import { upcomingBirthdays, describeDaysUntil } from "@/lib/birthdays";
import { tokenize, scrambleOrder, isCorrectOrder, pickRound, PUZZLE_VERSES } from "@/lib/verse-puzzle";
import { extractJson } from "@/lib/json";
import { detectCrisisSignal } from "@/lib/crisis-detection";
import { verseRefForDate, DAILY_VERSE_REFS } from "@/lib/bible";
import { buildWordSearch } from "@/lib/games/word-search";
import { createRng } from "@/lib/games/random";

const person = (birthDate: string, name = "A") => ({ userId: name, name, birthDate });

describe("upcomingBirthdays", () => {
  const today = new Date(2026, 8, 30); // 30 Sep 2026 (local)

  test("today counts as 0 days and computes the age being turned", () => {
    const [b] = upcomingBirthdays([person("1990-09-30")], today);
    expect(b.daysUntil).toBe(0);
    expect(b.turningAge).toBe(36);
    expect(describeDaysUntil(b.daysUntil)).toBe("Today");
  });

  test("respects the window and sorts soonest first", () => {
    const result = upcomingBirthdays(
      [person("1980-10-07", "seven"), person("1980-10-01", "one"), person("1980-10-08", "eight")],
      today,
      7
    );
    expect(result.map((b) => b.name)).toEqual(["one", "seven"]);
  });

  test("wraps over New Year", () => {
    const [b] = upcomingBirthdays([person("2000-01-02")], new Date(2026, 11, 30), 7);
    expect(b.daysUntil).toBe(3);
    expect(b.nextDate).toBe("2027-01-02");
    expect(b.turningAge).toBe(27);
  });

  test("Feb 29 birthdays are celebrated on Feb 28 in non-leap years", () => {
    const [b] = upcomingBirthdays([person("2004-02-29")], new Date(2027, 1, 25), 7);
    expect(b.nextDate).toBe("2027-02-28");
    expect(b.daysUntil).toBe(3);
  });

  test("a birthday that already passed this year isn't included", () => {
    expect(upcomingBirthdays([person("1990-09-29")], today, 7)).toEqual([]);
  });

  test("ignores malformed dates instead of crashing", () => {
    expect(upcomingBirthdays([person("not-a-date"), person("1990-13-40")], today)).toEqual([]);
  });
});

describe("verse puzzle", () => {
  test("tokenize keeps punctuation attached to words", () => {
    expect(tokenize("Jesus wept.")).toEqual(["Jesus", "wept."]);
  });

  test("scramble is always a permutation that differs from the original", () => {
    for (let n = 2; n < 20; n++) {
      const order = scrambleOrder(n);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(order.some((v, i) => v !== i)).toBe(true);
    }
  });

  test("scramble still differs with a pathological RNG", () => {
    const order = scrambleOrder(5, () => 0.99999); // Fisher-Yates with this picks identity
    expect(order.some((v, i) => v !== i)).toBe(true);
  });

  test("answers are compared by word, so swapped duplicate words still count", () => {
    const words = ["Don't", "be", "afraid.", "Don't", "be", "dismayed"];
    expect(isCorrectOrder(words, [...words])).toBe(true);
    expect(isCorrectOrder(words, ["be", "Don't", "afraid.", "Don't", "be", "dismayed"])).toBe(false);
  });

  test("a round has distinct, playable verses", () => {
    const round = pickRound(5);
    expect(round).toHaveLength(5);
    expect(new Set(round.map((v) => v.reference)).size).toBe(5);
    round.forEach((v) => expect(tokenize(v.text).length).toBeGreaterThanOrEqual(4));
  });

  test("all built-in verses have a reference and text", () => {
    PUZZLE_VERSES.forEach((v) => {
      expect(v.reference).toMatch(/\d/);
      expect(v.text.length).toBeGreaterThan(5);
    });
  });
});

describe("extractJson (AI output parsing)", () => {
  test("parses plain JSON", () => {
    expect(extractJson<string[]>('["John 3:16"]')).toEqual(["John 3:16"]);
  });
  test("strips ```json fences and leading chatter", () => {
    expect(extractJson<{ a: number }>('Sure! Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
  test("returns null on garbage instead of throwing", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{ broken")).toBeNull();
  });
});

describe("crisis detection (tripwire, not a classifier)", () => {
  test.each(["I want to kill myself", "thinking about suicide", "I've been self-harming", "I want to die"])(
    "flags: %s",
    (text) => expect(detectCrisisSignal(text)).toBe(true)
  );
  test.each(["I'm dying to see the youth camp photos", "Please pray for my exams", "The sermon killed it today"])(
    "does not flag: %s",
    (text) => expect(detectCrisisSignal(text)).toBe(false)
  );
});

describe("verse of the day", () => {
  test("is the same all day and changes the next day", () => {
    const morning = verseRefForDate(new Date(2026, 8, 30, 6));
    const night = verseRefForDate(new Date(2026, 8, 30, 23));
    const tomorrow = verseRefForDate(new Date(2026, 9, 1, 6));
    expect(morning).toBe(night);
    expect(DAILY_VERSE_REFS).toContain(morning);
    expect(tomorrow).not.toBe(morning);
  });
});

describe("word search generator", () => {
  test("every placed word can actually be read from the grid", () => {
    for (let run = 0; run < 25; run++) {
      const { grid, words } = buildWordSearch("medium", createRng(run));
      expect(grid).toHaveLength(12);
      grid.forEach((row) => expect(row.every((c) => /^[A-Z]$/.test(c))).toBe(true));
      for (const w of words) {
        const dr = Math.sign(w.end[0] - w.start[0]);
        const dc = Math.sign(w.end[1] - w.start[1]);
        const read = [...w.word].map((_, i) => grid[w.start[0] + dr * i][w.start[1] + dc * i]).join("");
        expect(read).toBe(w.word);
      }
    }
  });
});
