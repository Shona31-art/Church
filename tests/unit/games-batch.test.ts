import { describe, expect, test } from "vitest";
import { createRng } from "@/lib/games/random";
import {
  buildBooksOrder,
  buildEmojiSet,
  buildScramble,
  buildVerseFillSet,
  buildWhoSaidSet,
  checkBooksOrder,
  checkScramble,
  isSetAnswerCorrect,
  normalize,
  setQuestionView,
} from "@/lib/games/word-games";
import { E, MAZE_POINTS, MAZE_SIZES, N, S, W, buildMaze, checkMaze, type Maze } from "@/lib/games/maze";
import { BADGES, DAILY_ROTATION, currentStreak, dailyGame, dailySeed, earnedBadges } from "@/lib/games/progression";
import { BIBLE_BOOKS } from "@/lib/games/content/books";
import { EMOJI_STORIES } from "@/lib/games/content/emoji-stories";
import { BIBLE_QUOTES } from "@/lib/games/content/quotes";
import { GAME_KEYS } from "@/lib/games/catalog";

describe("content", () => {
  test("66 books, no duplicates", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(new Set(BIBLE_BOOKS).size).toBe(66);
  });
  test("every emoji story and quote has a reference; enough for each level and for Kids mode", () => {
    for (const s of EMOJI_STORIES) expect(s.reference).toMatch(/\d/);
    for (const q of BIBLE_QUOTES) expect(q.reference).toMatch(/\d/);
    for (const level of ["easy", "medium", "hard"] as const) {
      expect(EMOJI_STORIES.filter((s) => s.level === level).length).toBeGreaterThanOrEqual(8);
      expect(BIBLE_QUOTES.filter((q) => q.level === level).length).toBeGreaterThanOrEqual(8);
    }
    expect(EMOJI_STORIES.filter((s) => s.kids).length).toBeGreaterThanOrEqual(8);
    expect(BIBLE_QUOTES.filter((q) => q.kids).length).toBeGreaterThanOrEqual(8);
  });
  test("the daily rotation covers every game", () => {
    expect(new Set(DAILY_ROTATION)).toEqual(new Set(GAME_KEYS));
  });
});

describe("word scramble", () => {
  test("letters are a real shuffle of the answer; answers marked case- and space-insensitively", () => {
    const { puzzle, view } = buildScramble("medium", createRng(4));
    expect(view.items).toHaveLength(8);
    view.items.forEach((item, i) => {
      expect([...item.letters].sort().join("")).toBe([...puzzle.words[i].answer].sort().join(""));
      expect(item.letters).not.toBe(puzzle.words[i].answer);
    });
    const answers = puzzle.words.map((w) => w.answer.toLowerCase());
    answers[0] = ` ${answers[0].toUpperCase()} `;
    answers[1] = "wrong";
    expect(checkScramble(puzzle, answers)).toBe(7);
  });
  test("hard gives first-letter hints, not clues", () => {
    const { puzzle, view } = buildScramble("hard", createRng(2));
    expect(view.items[0].hint).toBe(`Starts with ${puzzle.words[0].answer[0]}`);
  });
});

describe("question sets", () => {
  test("choice questions: four distinct choices including the answer; the view never includes it", () => {
    for (const q of [...buildEmojiSet("easy", createRng(1)), ...buildWhoSaidSet("medium", createRng(1)), ...buildVerseFillSet("medium", createRng(1))]) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices![q.answerIndex!]).toBe(q.answer);
      expect(isSetAnswerCorrect(q, q.answerIndex!)).toBe(true);
      expect(isSetAnswerCorrect(q, (q.answerIndex! + 1) % 4)).toBe(false);
    }
    const view = setQuestionView(buildEmojiSet("easy", createRng(1)));
    expect(JSON.stringify(view)).not.toContain("answerIndex");
  });

  test("hard emoji: typed answers match on a keyword", () => {
    const [q] = buildEmojiSet("hard", createRng(3));
    expect(q.choices).toBeUndefined();
    expect(isSetAnswerCorrect(q, `It's the story of ${q.accepted![0]}!`)).toBe(true);
    expect(isSetAnswerCorrect(q, "no idea")).toBe(false);
    expect(isSetAnswerCorrect(q, "")).toBe(false);
  });

  test("hard verse fill: the missing words, typed in order, must match exactly", () => {
    const [q] = buildVerseFillSet("hard", createRng(5));
    expect(q.prompt.match(/_____/g)).toHaveLength(2);
    const words = q.answer.split(" / ").join(" ");
    expect(isSetAnswerCorrect(q, words.toUpperCase(), true)).toBe(true);
    expect(isSetAnswerCorrect(q, `${words} extra`, true)).toBe(false);
  });

  test("Kids mode uses kids-friendly content", () => {
    const kidsAnswers = new Set(EMOJI_STORIES.filter((s) => s.kids).map((s) => s.answer));
    expect(buildEmojiSet("easy", createRng(9), true).every((q) => kidsAnswers.has(q.answer))).toBe(true);
  });

  test("normalize drops case, apostrophes and punctuation", () => {
    expect(normalize("Noah's Ark!")).toBe("noahs ark");
  });
});

describe("books in order", () => {
  test("easy/medium are consecutive runs; hard is a whole section; marking counts right positions", () => {
    const easy = buildBooksOrder("easy", createRng(8));
    const start = BIBLE_BOOKS.indexOf(easy.puzzle.books[0]);
    expect(easy.puzzle.books).toEqual(BIBLE_BOOKS.slice(start, start + 5));
    expect(easy.view.books).not.toEqual(easy.puzzle.books);
    expect(buildBooksOrder("hard", createRng(8)).puzzle.section).not.toBeNull();
    expect(checkBooksOrder(easy.puzzle, easy.puzzle.books)).toBe(5);
    expect(checkBooksOrder(easy.puzzle, [...easy.puzzle.books].reverse())).toBe(1); // only the middle stays put
  });
});

describe("maze", () => {
  /** Breadth-first search for the route from start to goal. */
  function solve(maze: Maze): string {
    const moves: [string, number, number][] = [["U", -maze.size, N], ["R", 1, E], ["D", maze.size, S], ["L", -1, W]];
    const prev = new Map<number, [number, string]>([[0, [-1, ""]]]);
    const queue = [0];
    while (queue.length) {
      const at = queue.shift()!;
      for (const [m, delta, bit] of moves) {
        const next = at + delta;
        if (maze.cells[at] & bit && !prev.has(next)) {
          prev.set(next, [at, m]);
          queue.push(next);
        }
      }
    }
    let route = "";
    for (let at = maze.size * maze.size - 1; at !== 0; at = prev.get(at)![0]) route = prev.get(at)![1] + route;
    return route;
  }

  test("every square is reachable (a perfect maze), and the solved route scores", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      const maze = buildMaze(level, createRng(13));
      expect(maze.size).toBe(MAZE_SIZES[level]);
      expect(maze.cells.every((c) => c !== 0)).toBe(true);
      expect(checkMaze(maze, solve(maze))).toBe(MAZE_POINTS);
    }
  });

  test("walking through a wall, stopping short or nonsense routes score nothing", () => {
    const maze = buildMaze("easy", createRng(21));
    const route = solve(maze);
    expect(checkMaze(maze, route.slice(0, -1))).toBe(0);
    const wall = maze.cells[0] & N ? "L" : "U"; // the start is in a corner: up or left is always a wall
    expect(checkMaze(maze, wall + route)).toBe(0);
    expect(checkMaze(maze, "XYZ")).toBe(0);
    expect(checkMaze(maze, "R".repeat(10_000))).toBe(0);
  });

  test("wrong turns cost points: in and back out again is one point", () => {
    const maze = buildMaze("medium", createRng(5));
    const route = solve(maze);
    // A detour off the start square and straight back (whichever way is open).
    const out = (["R", "D"] as const).find((m) => maze.cells[0] & (m === "R" ? E : S))!;
    const back = out === "R" ? "L" : "U";
    expect(checkMaze(maze, out + back + route)).toBe(MAZE_POINTS - 1);
    expect(checkMaze(maze, (out + back).repeat(30) + route)).toBe(1);
  });
});

describe("daily challenge, streaks, badges", () => {
  test("the daily game changes each day and the seed is shared within a church", () => {
    expect(dailyGame("2026-10-10")).not.toBe(dailyGame("2026-10-11"));
    expect(dailySeed("church-a", "2026-10-10")).toBe(dailySeed("church-a", "2026-10-10"));
    expect(dailySeed("church-a", "2026-10-10")).not.toBe(dailySeed("church-b", "2026-10-10"));
  });

  test("streak counts back from today, or from yesterday before today's game", () => {
    expect(currentStreak(["2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(3);
    expect(currentStreak(["2026-10-08", "2026-10-09"], "2026-10-10")).toBe(2);
    expect(currentStreak(["2026-10-07", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(2);
    expect(currentStreak(["2026-10-01"], "2026-10-10")).toBe(0);
  });

  test("badges follow their rules", () => {
    const base = { totalGames: 1, gameTypes: new Set(["quiz"]), crosswords: 0, dailyChallenges: 0, streak: 1, last: { level: "easy", correct: 3, max: 10, timed: false, durationMs: 60_000, parSeconds: 90 } };
    expect(earnedBadges(base)).toEqual(["first_game"]);
    expect(earnedBadges({ ...base, last: { ...base.last, level: "hard", correct: 10 } })).toContain("hard_perfect");
    expect(earnedBadges({ ...base, last: { ...base.last, level: "medium", correct: 10, timed: true } })).toContain("quick_and_sure");
    expect(earnedBadges({ ...base, streak: 7 })).toContain("streak_7");
    expect(Object.keys(BADGES).length).toBeGreaterThan(5);
  });
});
