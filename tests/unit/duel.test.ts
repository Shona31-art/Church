import { describe, expect, test } from "vitest";
import { DUEL_SECONDS, duelClock, duelPhase, duelWinner, sideOf, timeAnswer, type DuelRow } from "@/lib/games/duel";

const A = "a", B = "b";
const base: DuelRow = {
  id: "d", challenger_id: A, opponent_id: B, level: "easy", status: "pending", questions: [],
  challenger_done: 0, opponent_done: 0, challenger_started_at: null, opponent_started_at: null,
  challenger_finished_at: null, opponent_finished_at: null, challenger_score: null, opponent_score: null,
  challenger_ms: null, opponent_ms: null, winner_id: null, created_at: "2026-11-03T10:00:00Z",
  expires_at: "2026-11-05T10:00:00Z", finished_at: null,
};
const now = new Date("2026-11-03T12:00:00Z");

describe("Bible duel rules", () => {
  test("most right answers wins, then the quicker player, else a draw", () => {
    expect(duelWinner({ score: 8, ms: 90_000 }, { score: 7, ms: 30_000 })).toBe("a");
    expect(duelWinner({ score: 7, ms: 50_000 }, { score: 7, ms: 40_000 })).toBe("b");
    expect(duelWinner({ score: 7, ms: 40_000 }, { score: 7, ms: 40_000 })).toBe("draw");
  });

  test("answers after the timer don't count; time is capped at the limit", () => {
    const shown = new Date("2026-11-03T12:00:00Z");
    expect(timeAnswer(shown, new Date(shown.getTime() + 4200))).toEqual({ ms: 4200, inTime: true });
    expect(timeAnswer(shown, new Date(shown.getTime() + DUEL_SECONDS * 1000 + 1000)).inTime).toBe(true); // network allowance
    expect(timeAnswer(shown, new Date(shown.getTime() + 60_000))).toEqual({ ms: DUEL_SECONDS * 1000, inTime: false });
  });

  test("what each player sees", () => {
    expect(sideOf(base, A)).toBe("challenger");
    expect(duelPhase(base, B, now)).toBe("respond");
    expect(duelPhase(base, A, now)).toBe("ready"); // the challenger can play straight away
    expect(duelPhase({ ...base, status: "active", opponent_started_at: "x" }, B, now)).toBe("playing");
    expect(duelPhase({ ...base, status: "active", opponent_started_at: "x", opponent_finished_at: "y" }, B, now)).toBe("waiting");
    expect(duelPhase({ ...base, status: "finished" }, A, now)).toBe("finished");
    expect(duelPhase(base, A, new Date("2026-11-06T00:00:00Z"))).toBe("expired");
    expect(duelClock(65_400)).toBe("1:05");
  });
});
