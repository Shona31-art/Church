import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameKey, Level } from "@/lib/games/catalog";
import { createRng, shuffle } from "@/lib/games/random";
import { QUIZ_LENGTH, checkQuiz, type QuizKey, type QuizProgress } from "@/lib/games/quiz";
import { buildWordSearch, checkWordSearch, type WordSearchPuzzle } from "@/lib/games/word-search";
import { buildCrossword, checkCrossword, entryCells, type CrosswordPuzzle, type Direction } from "@/lib/games/crossword";
import { countSolvedVerses, pickRoundForLevel, scrambleOrder, tokenize, type PuzzleVerse, type VerseProgress } from "@/lib/verse-puzzle";
import { CROSSWORD_CLUES } from "@/lib/games/content/crossword-clues";
import {
  buildBooksOrder,
  buildEmojiSet,
  buildScramble,
  buildVerseFillSet,
  buildWhoSaidSet,
  checkBooksOrder,
  checkScramble,
  setQuestionView,
  type BooksPuzzle,
  type ScramblePuzzle,
  type SetQuestion,
} from "@/lib/games/word-games";
import { MAZE_POINTS, MAZE_THEMES, buildMaze, checkMaze, type Maze } from "@/lib/games/maze";
import { JIGSAW_SCENES, buildJigsaw, checkJigsaw, type JigsawPuzzle, type JigsawSceneKey } from "@/lib/games/jigsaw";

// One entry per game: how to build a puzzle (the full answer key, kept in
// the server-only game_sessions row, plus the "view" the player is sent),
// what a finished game's answers look like, and how to mark them.
//
// The view never contains answers the player shouldn't have — the quiz view
// has no correct choices; the verse view has the words already scrambled.

export interface BuiltGame {
  puzzle: unknown;
  view: unknown;
  maxCorrect: number;
}

/** One line of the after-game review: what the answer was and whether you got it. */
export interface ReviewItem {
  label: string;
  prompt: string;
  answer: string;
  reference?: string;
  correct: boolean;
}

interface GameEngine {
  /** `kids`: Kids mode — simpler content only (the level is always Easy). */
  build(level: Level, seed: number, ctx: { supabase: SupabaseClient; churchId: string; kids: boolean }): Promise<BuiltGame | { error: string }>;
  answers: z.ZodTypeAny;
  check(puzzle: any, progress: any, answers: any): number;
  /** Optional: answers to show once the game is over. */
  review?(puzzle: any, progress: any, answers: any): ReviewItem[];
}

// --- Quiz --------------------------------------------------------------------

export interface QuizView {
  questions: { question: string; choices: string[] }[];
}

const quiz: GameEngine = {
  async build(level, seed, { supabase, churchId, kids }) {
    // Global bank + this church's own questions.
    const { data, error } = await supabase
      .from("bible_quiz_questions")
      .select("id, question, choices, correct_index, difficulty, kids_ok")
      .or(`church_id.is.null,church_id.eq.${churchId}`)
      .order("id");
    if (error || !data?.length) return { error: "No quiz questions are available yet." };

    const rng = createRng(seed);
    // This level's questions first; top up from other levels if the bank is thin.
    const fits = (q: (typeof data)[number]) => (kids ? q.kids_ok : q.difficulty === level);
    const atLevel = shuffle(data.filter(fits), rng);
    const others = shuffle(data.filter((q) => !fits(q) && (!kids || q.difficulty === "easy")), rng);
    const chosen = [...atLevel, ...others].slice(0, QUIZ_LENGTH);

    // Shuffle each question's choices so the right answer isn't always in the same place.
    const shuffled = chosen.map((q) => {
      const choices = q.choices as string[];
      const order = shuffle(choices.map((_, i) => i), rng);
      return { question: q.question, choices: order.map((i) => choices[i]), correct: order.indexOf(q.correct_index) };
    });
    const key: QuizKey = { ids: chosen.map((q) => q.id), correct: shuffled.map((q) => q.correct) };
    const view: QuizView = { questions: shuffled.map(({ question, choices }) => ({ question, choices })) };
    return { puzzle: key, view, maxCorrect: chosen.length };
  },
  // Quiz choices are locked in one by one (revealQuizAnswer), so nothing is submitted at the end.
  answers: z.null().optional(),
  check: (key: QuizKey, progress: QuizProgress) => checkQuiz(key, progress ?? {}),
};

// --- Word search ----------------------------------------------------------------

export interface WordSearchView {
  size: number;
  grid: string[][];
  words: string[];
}

const cell = z.tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(30)]);

const wordSearch: GameEngine = {
  async build(level, seed) {
    const puzzle = buildWordSearch(level, createRng(seed));
    const view: WordSearchView = { size: puzzle.size, grid: puzzle.grid, words: puzzle.words.map((w) => w.word) };
    return { puzzle, view, maxCorrect: puzzle.words.length };
  },
  answers: z.array(z.object({ word: z.string().max(30), start: cell, end: cell })).max(40),
  check: (puzzle: WordSearchPuzzle, _progress, finds) => checkWordSearch(puzzle, finds),
};

// --- Verse puzzle --------------------------------------------------------------

export interface VersePuzzleView {
  verses: { reference: string; words: string[] }[];
}

const versePuzzle: GameEngine = {
  async build(level, seed) {
    const rng = createRng(seed);
    const verses = pickRoundForLevel(level, rng);
    const view: VersePuzzleView = {
      verses: verses.map((v) => {
        const words = tokenize(v.text);
        return { reference: v.reference, words: scrambleOrder(words.length, rng).map((i) => words[i]) };
      }),
    };
    return { puzzle: { verses }, view, maxCorrect: verses.length };
  },
  // Verses are checked one by one (checkVerseAttempt / revealVerse), so nothing is submitted at the end.
  answers: z.null().optional(),
  check: (puzzle: { verses: PuzzleVerse[] }, progress: VerseProgress) => countSolvedVerses(puzzle.verses.length, progress ?? {}),
};

// --- Crossword ----------------------------------------------------------------

export interface CrosswordView {
  width: number;
  height: number;
  /** One string per row: "#" = no square, "." = a square to fill. */
  shape: string[];
  entries: { number: number; direction: Direction; row: number; col: number; length: number; clue: string; reference: string }[];
}

const crossword: GameEngine = {
  async build(level, seed, { kids }) {
    const puzzle = buildCrossword(level, seed, kids ? CROSSWORD_CLUES.filter((c) => c.kids) : undefined);
    const shape = Array.from({ length: puzzle.height }, () => Array<string>(puzzle.width).fill("#"));
    for (const e of puzzle.entries) for (const [r, c] of entryCells(e, e.answer.length)) shape[r][c] = ".";
    const view: CrosswordView = {
      width: puzzle.width,
      height: puzzle.height,
      shape: shape.map((r) => r.join("")),
      entries: puzzle.entries.map(({ answer, ...e }) => ({ ...e, length: answer.length })),
    };
    return { puzzle, view, maxCorrect: puzzle.entries.length };
  },
  // The player's letters, one string per row.
  answers: z.array(z.string().max(40)).max(40),
  check: (puzzle: CrosswordPuzzle, _progress, grid) => checkCrossword(puzzle, grid),
  review: (puzzle: CrosswordPuzzle, _progress, grid: string[]) =>
    puzzle.entries.map((e) => ({
      label: `${e.number} ${e.direction === "across" ? "Across" : "Down"}`,
      prompt: e.clue,
      answer: e.answer,
      reference: e.reference,
      correct: checkCrossword({ ...puzzle, entries: [e] }, grid) === 1,
    })),
};

// --- Question sets: emoji stories, "Who said it?", fill in the verse ------------

/** Progress for question sets: each answer is locked in as it's given. */
export type SetProgress = Record<string, { answer: number | string; correct: boolean }>;

export interface SetPuzzle {
  questions: SetQuestion[];
  /** Typed answers must match exactly (verse fill) rather than contain a keyword. */
  exact: boolean;
}

function questionSet(make: (level: Level, rng: ReturnType<typeof createRng>, kids: boolean) => SetQuestion[], exact = false): GameEngine {
  return {
    async build(level, seed, { kids }) {
      const questions = make(level, createRng(seed), kids);
      if (!questions.length) return { error: "No puzzles are available for this level yet." };
      return { puzzle: { questions, exact } satisfies SetPuzzle, view: setQuestionView(questions), maxCorrect: questions.length };
    },
    // Answered one at a time (answerSetQuestion), so nothing is submitted at the end.
    answers: z.null().optional(),
    check: (_puzzle: SetPuzzle, progress: SetProgress) => Object.values(progress ?? {}).filter((p) => p.correct).length,
    review: (puzzle: SetPuzzle, progress: SetProgress) =>
      puzzle.questions.map((q, i) => ({ label: `${i + 1}`, prompt: q.prompt, answer: q.answer, reference: q.reference, correct: Boolean(progress?.[String(i)]?.correct) })),
  };
}

export type SetView = ReturnType<typeof setQuestionView>;

// --- Word scramble ---------------------------------------------------------------

const scramble: GameEngine = {
  async build(level, seed, { kids }) {
    const { puzzle, view } = buildScramble(level, createRng(seed), kids);
    return { puzzle, view, maxCorrect: puzzle.words.length };
  },
  answers: z.array(z.string().max(40)).max(20),
  check: (puzzle: ScramblePuzzle, _progress, answers) => checkScramble(puzzle, answers),
  review: (puzzle: ScramblePuzzle, _progress, answers: string[]) =>
    puzzle.words.map((w, i) => ({ label: `${i + 1}`, prompt: w.clue, answer: w.answer, reference: w.reference, correct: checkScramble({ words: [w] }, [answers[i] ?? ""]) === 1 })),
};

// --- Books in order ----------------------------------------------------------------

const booksOrder: GameEngine = {
  async build(level, seed) {
    const { puzzle, view } = buildBooksOrder(level, createRng(seed));
    return { puzzle, view, maxCorrect: puzzle.books.length };
  },
  answers: z.array(z.string().max(40)).max(20),
  check: (puzzle: BooksPuzzle, _progress, order) => checkBooksOrder(puzzle, order),
  review: (puzzle: BooksPuzzle, _progress, order: string[]) =>
    puzzle.books.map((b, i) => ({ label: `${i + 1}`, prompt: `You put ${order[i] ?? "nothing"}`, answer: b, correct: order[i] === b })),
};

// --- Maze ----------------------------------------------------------------------

export interface MazeView extends Maze {
  title: string;
  start: string;
  goal: string;
  reference: string;
}

const maze: GameEngine = {
  async build(level, seed) {
    const built = buildMaze(level, createRng(seed));
    const theme = MAZE_THEMES[built.theme];
    const view: MazeView = { ...built, title: theme.title, start: theme.start, goal: theme.goal, reference: theme.reference };
    return { puzzle: built, view, maxCorrect: MAZE_POINTS };
  },
  // The route taken: a string of U/R/D/L moves.
  answers: z.string().max(4000),
  check: (puzzle: Maze, _progress, route) => checkMaze(puzzle, route),
};

// --- Jigsaw ------------------------------------------------------------------

export interface JigsawView {
  scene: JigsawSceneKey;
  title: string;
  reference: string;
  size: number;
  order: number[];
}

const jigsaw: GameEngine = {
  async build(level, seed) {
    const puzzle = buildJigsaw(level, createRng(seed));
    const info = JIGSAW_SCENES.find((s) => s.key === puzzle.scene)!;
    const view: JigsawView = { scene: puzzle.scene, title: info.title, reference: info.reference, size: puzzle.size, order: puzzle.order };
    return { puzzle, view, maxCorrect: puzzle.size * puzzle.size };
  },
  // The final arrangement: arrangement[slot] = piece.
  answers: z.array(z.number().int().min(0).max(99)).max(100),
  check: (puzzle: JigsawPuzzle, _progress, arrangement) => checkJigsaw(puzzle, arrangement),
};

export const ENGINES: Record<GameKey, GameEngine> = {
  jigsaw,
  quiz,
  crossword,
  emoji: questionSet(buildEmojiSet),
  who_said: questionSet(buildWhoSaidSet),
  verse_fill: questionSet(buildVerseFillSet, true),
  scramble,
  books_order: booksOrder,
  maze,
  word_search: wordSearch,
  verse_puzzle: versePuzzle,
};
