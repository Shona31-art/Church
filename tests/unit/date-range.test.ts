import { describe, expect, test } from "vitest";
import { daysBetween, groupConsecutiveDays } from "@/lib/date-range";

describe("away date ranges", () => {
  test("lists every day, across a month end, both ends included", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(daysBetween("2026-11-05", "2026-11-05")).toEqual(["2026-11-05"]);
    expect(daysBetween("2026-11-05", "2026-11-04")).toEqual([]);
  });

  test("joins back-to-back days for the same pastor and note into one range", () => {
    const row = (id: string, date: string, key = "p1|Leave") => ({ id, date, key });
    const ranges = groupConsecutiveDays([row("c", "2026-11-04"), row("a", "2026-11-02"), row("b", "2026-11-03"), row("d", "2026-11-10"), row("e", "2026-11-03", "p2|")]);
    expect(ranges.map((r) => [r.start, r.end, r.rows.length])).toEqual([
      ["2026-11-02", "2026-11-04", 3],
      ["2026-11-03", "2026-11-03", 1],
      ["2026-11-10", "2026-11-10", 1],
    ]);
  });
});
