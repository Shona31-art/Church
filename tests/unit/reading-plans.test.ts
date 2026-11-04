import { describe, expect, test } from "vitest";
import { buildDays, planDayNumber, readingLabel, streak, PRESETS } from "@/lib/reading-plans";
import { blankCount, fillOutline, parseOutline, sameAnswer } from "@/lib/sermon-notes";

describe("reading plans", () => {
  test("whole books split into days", () => {
    expect(buildDays("John", "John", 1)).toHaveLength(21);
    expect(buildDays("Psalms", "Psalms", 5)).toHaveLength(30);
    expect(buildDays("Matthew", "Revelation", 1)).toHaveLength(260);
    expect(buildDays("John", "Genesis", 1)).toEqual([]);
    for (const p of PRESETS) expect(buildDays(p.from, p.to, p.perDay).length).toBeGreaterThan(0);
  });
  test("labels join chapters", () => {
    expect(readingLabel(buildDays("Psalms", "Psalms", 5)[0].readings)).toBe("Psalms 1–5");
    expect(readingLabel([{ book: "John", chapter: 21 }, { book: "Acts", chapter: 1 }])).toBe("John 21, Acts 1");
  });
  test("day numbers and streaks", () => {
    expect(planDayNumber("2026-03-01", "2026-03-01")).toBe(1);
    expect(planDayNumber("2026-03-01", "2026-03-10")).toBe(10);
    expect(streak(["2026-03-08", "2026-03-09", "2026-03-10"], "2026-03-10")).toBe(3);
    expect(streak(["2026-03-08", "2026-03-09"], "2026-03-10")).toBe(2); // not read yet today: still counts
    expect(streak(["2026-03-07", "2026-03-09"], "2026-03-11")).toBe(0);
  });
});

describe("sermon notes", () => {
  const body = "Grace is [[free]]. Say [[no]] to sin.";
  test("blanks are found and filled", () => {
    expect(blankCount(body)).toBe(2);
    expect(parseOutline(body)).toEqual([{ text: "Grace is " }, { blank: 0, answer: "free" }, { text: ". Say " }, { blank: 1, answer: "no" }, { text: " to sin." }]);
    expect(fillOutline(body, ["Free"])).toBe("Grace is Free. Say ____ to sin.");
  });
  test("answers match loosely", () => {
    expect(sameAnswer(" FREE! ", "free")).toBe(true);
    expect(sameAnswer("", "free")).toBe(false);
    expect(sameAnswer("fee", "free")).toBe(false);
  });
});
