// What a player has already had in each game, read from their past games
// (game_sessions.puzzle), so new games give them questions they haven't seen
// (lib/games/random.ts: freshFirst). Pure — unit-tested.

import type { GameKey } from "@/lib/games/catalog";

/** The keys of the questions (or words, verses…) in a saved puzzle. */
export function puzzleKeys(game: GameKey | string, puzzle: unknown): string[] {
  const p = (puzzle ?? {}) as Record<string, any>;
  switch (game) {
    case "quiz":
      return ((p.ids ?? []) as unknown[]).map(String);
    case "emoji":
    case "who_said":
    case "verse_fill":
      return ((p.questions ?? []) as { prompt?: string; answer?: string; reference?: string }[]).map((q) => setQuestionKey(game, q));
    case "scramble":
      return ((p.words ?? []) as { answer?: string }[]).map((w) => String(w.answer ?? ""));
    case "verse_puzzle":
      return ((p.verses ?? []) as { reference?: string }[]).map((v) => String(v.reference ?? ""));
    default:
      return [];
  }
}

/** One question's key in a question set: the story, the quotation or the verse. */
export function setQuestionKey(game: string, q: { prompt?: string; answer?: string; reference?: string }): string {
  if (game === "emoji") return String(q.answer ?? "");
  if (game === "who_said") return String(q.prompt ?? "");
  return String(q.reference ?? "");
}

/** Key → recency (the most recent game is highest) from past puzzles, newest first. */
export function seenFrom(game: string, puzzlesNewestFirst: readonly unknown[]): Map<string, number> {
  const seen = new Map<string, number>();
  puzzlesNewestFirst.forEach((puzzle, i) => {
    const recency = puzzlesNewestFirst.length - i;
    for (const key of puzzleKeys(game, puzzle)) if (key && !seen.has(key)) seen.set(key, recency);
  });
  return seen;
}
