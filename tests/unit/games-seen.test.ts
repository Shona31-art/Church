import { describe, expect, test } from "vitest";
import { createRng, freshFirst } from "@/lib/games/random";
import { puzzleKeys, seenFrom } from "@/lib/games/seen";
import { buildEmojiSet, buildWhoSaidSet } from "@/lib/games/word-games";
import { EMOJI_STORIES } from "@/lib/games/content/emoji-stories";
import { BIBLE_QUOTES } from "@/lib/games/content/quotes";

describe("questions don't repeat", () => {
  test("unseen first, then the longest-ago", () => {
    const items = ["a", "b", "c", "d", "e"];
    const seen = new Map([["a", 3], ["b", 1], ["c", 2]]);
    const out = freshFirst(items, createRng(1), (x) => x, seen);
    expect(out.slice(0, 2).sort()).toEqual(["d", "e"]);
    expect(out.slice(2)).toEqual(["b", "c", "a"]);
  });

  test("without history it's a plain, repeatable shuffle", () => {
    expect(freshFirst([1, 2, 3, 4], createRng(9), String)).toEqual(freshFirst([1, 2, 3, 4], createRng(9), String));
  });

  test("past games are read back into what's been seen, newest highest", () => {
    const seen = seenFrom("quiz", [{ ids: [5, 6] }, { ids: [6, 7] }]);
    expect(seen.get("5")).toBe(2);
    expect(seen.get("6")).toBe(2);
    expect(seen.get("7")).toBe(1);
    expect(puzzleKeys("maze", { size: 5 })).toEqual([]);
  });

  test("playing a question set again gives new questions until the set runs out", () => {
    for (const [game, build, pool] of [
      ["emoji", buildEmojiSet, EMOJI_STORIES.filter((s) => s.level === "medium").length],
      ["who_said", buildWhoSaidSet, BIBLE_QUOTES.filter((q) => q.level === "medium").length],
    ] as const) {
      const first = build("medium", createRng(1));
      const second = build("medium", createRng(2), false, seenFrom(game, [{ questions: first }]));
      const a = puzzleKeys(game, { questions: first });
      const b = puzzleKeys(game, { questions: second });
      const repeats = b.filter((k) => a.includes(k)).length;
      // Only as many repeats as there weren't enough new questions for.
      expect(repeats).toBe(Math.max(0, a.length + b.length - pool));
    }
  });
});
