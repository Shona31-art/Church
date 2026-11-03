// Bible Quiz Duel rules (pure — unit-tested). See supabase/game_duels.sql.

/** How many questions the challenger can choose; 20 unless they pick otherwise. */
export const DUEL_LENGTHS = [10, 20, 30] as const;
export const DUEL_DEFAULT_LENGTH = 20;
/** Seconds to answer each question. */
export const DUEL_SECONDS = 20;
/** Allowance for the answer travelling to the server. */
const NETWORK_GRACE_MS = 3000;

export type DuelSide = "challenger" | "opponent";

export interface DuelRow {
  id: string;
  challenger_id: string;
  opponent_id: string;
  level: "easy" | "medium" | "hard";
  status: "pending" | "active" | "finished" | "declined" | "cancelled";
  questions: { question: string; choices: string[] }[];
  challenger_done: number;
  opponent_done: number;
  challenger_started_at: string | null;
  opponent_started_at: string | null;
  challenger_finished_at: string | null;
  opponent_finished_at: string | null;
  challenger_score: number | null;
  opponent_score: number | null;
  challenger_ms: number | null;
  opponent_ms: number | null;
  winner_id: string | null;
  created_at: string;
  expires_at: string;
  finished_at: string | null;
}

export function sideOf(duel: Pick<DuelRow, "challenger_id" | "opponent_id">, userId: string): DuelSide | null {
  return duel.challenger_id === userId ? "challenger" : duel.opponent_id === userId ? "opponent" : null;
}

export const otherSide = (side: DuelSide): DuelSide => (side === "challenger" ? "opponent" : "challenger");

/**
 * How long an answer took, and whether it still counts: answers after the
 * timer (plus a little for the network) count as wrong.
 */
export function timeAnswer(questionShownAt: Date, now: Date): { ms: number; inTime: boolean } {
  const ms = Math.max(0, now.getTime() - questionShownAt.getTime());
  return { ms: Math.min(ms, DUEL_SECONDS * 1000), inTime: ms <= DUEL_SECONDS * 1000 + NETWORK_GRACE_MS };
}

/** Most right answers wins; a tie goes to the quicker player; same again is a draw. */
export function duelWinner(a: { score: number; ms: number }, b: { score: number; ms: number }): "a" | "b" | "draw" {
  if (a.score !== b.score) return a.score > b.score ? "a" : "b";
  if (a.ms !== b.ms) return a.ms < b.ms ? "a" : "b";
  return "draw";
}

export type DuelPhase =
  | "respond" // the opponent hasn't accepted yet
  | "ready" // may play, hasn't started
  | "playing" // part-way through
  | "waiting" // finished; the other player hasn't
  | "finished"
  | "declined"
  | "cancelled"
  | "expired"; // ran out of time before anyone played

/** What this player should see now. The challenger may play before the opponent accepts. */
export function duelPhase(duel: DuelRow, userId: string, now: Date = new Date()): DuelPhase {
  const side = sideOf(duel, userId);
  if (duel.status === "finished") return "finished";
  if (duel.status === "declined") return "declined";
  if (duel.status === "cancelled") return "cancelled";
  if (new Date(duel.expires_at).getTime() <= now.getTime()) return "expired";
  if (!side) return "expired";
  if (side === "opponent" && duel.status === "pending") return "respond";
  if (duel[`${side}_finished_at`]) return "waiting";
  if (duel[`${side}_started_at`]) return "playing";
  return "ready";
}

/** "1:05", "0:42" */
export function duelClock(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
