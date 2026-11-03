import { expect, test } from "vitest";
import { challengeState, closesIn, ordinal, rankEntries } from "@/lib/games/challenge";

const e = (user_id: string, score: number, ms: number, finished = true, done = 10) => ({ user_id, score, ms, done, finished_at: finished ? "x" : null });

test("leaderboard: most right, then quickest; exact ties share a place; still playing last", () => {
  const ranked = rankEntries([e("c", 7, 60_000), e("a", 9, 90_000), e("b", 9, 80_000), e("d", 7, 60_000), e("p", 3, 9000, false, 4)]);
  expect(ranked.map((r) => [r.user_id, r.rank])).toEqual([["b", 1], ["a", 2], ["c", 3], ["d", 3], ["p", null]]);
});

test("open, closes in, ordinals", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  expect(challengeState({ starts_at: "2026-11-03T11:00:00Z", ends_at: "2026-11-03T13:00:00Z" }, now)).toBe("open");
  expect(challengeState({ starts_at: "2026-11-03T11:00:00Z", ends_at: "2026-11-03T11:30:00Z" }, now)).toBe("closed");
  expect(closesIn("2026-11-03T14:15:00Z", now)).toBe("2 h 15 min");
  expect(closesIn("2026-11-06T12:00:00Z", now)).toBe("3 days");
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
});
