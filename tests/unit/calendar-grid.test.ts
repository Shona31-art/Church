import { describe, expect, test } from "vitest";
import { buildMonthGrid, eventDays, monthRangeUtc, parseMonth, shiftMonth, dayInZone } from "@/lib/calendar-grid";

const TZ = "Africa/Johannesburg"; // UTC+2, no DST

describe("parseMonth", () => {
  test("reads YYYY-MM", () => {
    expect(parseMonth("2026-02", "2026-10-10")).toEqual({ year: 2026, month: 2 });
  });

  test("falls back to today's month for missing or junk input", () => {
    expect(parseMonth(undefined, "2026-10-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2026-13", "2026-10-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("abc", "2026-10-10")).toEqual({ year: 2026, month: 10 });
  });
});

describe("shiftMonth", () => {
  test("crosses year boundaries both ways", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("buildMonthGrid", () => {
  test("October 2026 starts on Thursday and fills whole Sunday-first weeks", () => {
    const weeks = buildMonthGrid({ year: 2026, month: 10 });
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toEqual({ date: "2026-09-27", inMonth: false }); // Sunday before 1 Oct
    expect(weeks[0][4]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(weeks[4][6]).toEqual({ date: "2026-10-31", inMonth: true });
  });

  test("February 2026 (starts on Sunday, 28 days) is exactly 4 weeks", () => {
    const weeks = buildMonthGrid({ year: 2026, month: 2 });
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0].date).toBe("2026-02-01");
  });
});

describe("monthRangeUtc", () => {
  test("bounds are local midnight in the church's timezone", () => {
    expect(monthRangeUtc({ year: 2026, month: 10 }, TZ)).toEqual({
      start: "2026-09-30T22:00:00.000Z",
      end: "2026-10-31T22:00:00.000Z",
    });
  });
});

describe("eventDays", () => {
  test("an evening event late in UTC still lands on its local day", () => {
    // 23:30 UTC on the 4th is 01:30 on the 5th in Johannesburg.
    expect(dayInZone("2026-10-04T23:30:00Z", TZ)).toBe("2026-10-05");
    expect(eventDays("2026-10-04T23:30:00Z", null, TZ)).toEqual(["2026-10-05"]);
  });

  test("a multi-day event covers each day, across a month end", () => {
    expect(eventDays("2026-10-30T16:00:00Z", "2026-11-01T12:00:00Z", TZ)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  test("an end before the start, or a huge range, is contained", () => {
    expect(eventDays("2026-10-05T08:00:00Z", "2026-10-01T08:00:00Z", TZ)).toEqual(["2026-10-05"]);
    expect(eventDays("2026-01-01T08:00:00Z", "2027-01-01T08:00:00Z", TZ)).toHaveLength(31);
  });
});
