import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameKey, Level } from "@/lib/games/catalog";
import { createRng, shuffle } from "@/lib/games/random";
import { QUIZ_LENGTH, checkQuiz, type QuizKey, type QuizProgress } from "@/lib/games/quiz";
import { buildWordSearch, checkWordSearch, type WordSearchPuzzle } from "@/lib/games/word-search";
import { countSolvedVerses, pickRoundForLevel, scrambleOrder, tokenize, type PuzzleVerse, type VerseProgress } from "@/lib/verse-puzzle";

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

interface GameEngine {
  build(level: Level, seed: number, ctx: { supabase: SupabaseClient; churchId: string }): Promise<BuiltGame | { error: string }>;
  answers: z.ZodTypeAny;
  check(puzzle: any, progress: any, answers: any): number;
}

// --- Quiz --------------------------------------------------------------------

export interface QuizView {
  questions: { question: string; choices: string[] }[];
}

const quiz: GameEngine = {
  async build(level, seed, { supabase, churchId }) {
    // Global bank + this church's own questions.
    const { data, error } = await supabase
      .from("bible_quiz_questions")
      .select("id, question, choices, correct_index, difficulty")
      .or(`church_id.is.null,church_id.eq.${churchId}`)
      .order("id");
    if (error || !data?.length) return { error: "No quiz questions are available yet." };

    const rng = createRng(seed);
    // This level's questions first; top up from other levels if the bank is thin.
    const atLevel = shuffle(data.filter((q) => q.difficulty === level), rng);
    const others = shuffle(data.filter((q) => q.difficulty !== level), rng);
    const chosen = [...atLevel, ...others].slice(0, QUIZ_LENGTH);

    const key: QuizKey = { ids: chosen.map((q) => q.id), correct: chosen.map((q) => q.correct_index) };
    const view: QuizView = { questions: chosen.map((q) => ({ question: q.question, choices: q.choices as string[] })) };
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

export const ENGINES: Record<GameKey, GameEngine> = {
  quiz,
  word_search: wordSearch,
  verse_puzzle: versePuzzle,
};
