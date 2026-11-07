// Word scramble, question sets (emoji stories, "Who said it?", fill in the
// verse) and books-in-order: seeded building and marking (pure — unit-tested).

import type { Level } from "./catalog";
import { freshFirst, shuffle, type Rng, type Seen } from "./random";
import { CROSSWORD_CLUES } from "./content/crossword-clues";
import { EMOJI_STORIES } from "./content/emoji-stories";
import { BIBLE_QUOTES } from "./content/quotes";
import { BIBLE_SECTIONS, BIBLE_BOOKS } from "./content/books";
import { PUZZLE_VERSES, tokenize } from "@/lib/verse-puzzle";

/** Lower-case letters and digits only — "Noah's Ark!" → "noahs ark". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Word scramble
// ---------------------------------------------------------------------------

export interface ScramblePuzzle {
  words: { answer: string; clue: string; reference: string }[];
}

export interface ScrambleView {
  items: { letters: string; hint: string; length: number }[];
}

const SCRAMBLE_LEVELS: Record<Level, { count: number; pool: Level[]; hint: "clue" | "first" }> = {
  easy: { count: 5, pool: ["easy"], hint: "clue" },
  medium: { count: 8, pool: ["medium"], hint: "clue" },
  hard: { count: 10, pool: ["hard", "medium"], hint: "first" },
};

/** Shuffles letters, guaranteeing the result isn't the word itself. */
function scrambleWord(word: string, rng: Rng): string {
  for (let i = 0; i < 10; i++) {
    const out = shuffle([...word], rng).join("");
    if (out !== word) return out;
  }
  return word.slice(1) + word[0];
}

export function buildScramble(level: Level, rng: Rng, kids = false, seen?: Seen): { puzzle: ScramblePuzzle; view: ScrambleView } {
  const rule = SCRAMBLE_LEVELS[level];
  const pool = CROSSWORD_CLUES.filter((c) => rule.pool.includes(c.level) && (!kids || c.kids));
  const words = freshFirst(pool, rng, (c) => c.answer, seen)
    .slice(0, rule.count)
    .map((c) => ({ answer: c.answer, clue: c.clue, reference: c.reference }));
  return {
    puzzle: { words },
    view: {
      items: words.map((w) => ({
        letters: scrambleWord(w.answer, rng),
        hint: rule.hint === "clue" ? w.clue : `Starts with ${w.answer[0]}`,
        length: w.answer.length,
      })),
    },
  };
}

export function checkScramble(puzzle: ScramblePuzzle, answers: readonly string[]): number {
  return puzzle.words.filter((w, i) => normalize(answers[i] ?? "").replace(/ /g, "") === w.answer.toLowerCase()).length;
}

// ---------------------------------------------------------------------------
// Question sets: emoji stories, "Who said it?", fill in the verse
// ---------------------------------------------------------------------------

export interface SetQuestion {
  /** Emoji, a quotation, or a verse with ____ blanks. */
  prompt: string;
  /** Answer choices; absent when the answer is typed. */
  choices?: string[];
  answerIndex?: number;
  /** For typed answers: correct if the answer contains any of these (normalised). */
  accepted?: string[];
  /** Shown after answering. */
  answer: string;
  reference: string;
}

export type QuestionSetKind = "emoji" | "who_said" | "verse_fill";

export const SET_LENGTH: Record<QuestionSetKind, number> = { emoji: 8, who_said: 8, verse_fill: 6 };

/** Four choices: the right one plus three others from `pool`, shuffled. */
function withChoices(answer: string, pool: readonly string[], rng: Rng): { choices: string[]; answerIndex: number } {
  const others = shuffle([...new Set(pool.filter((p) => p !== answer))], rng).slice(0, 3);
  const choices = shuffle([answer, ...others], rng);
  return { choices, answerIndex: choices.indexOf(answer) };
}

export function buildEmojiSet(level: Level, rng: Rng, kids = false, seen?: Seen): SetQuestion[] {
  const atLevel = EMOJI_STORIES.filter((s) => (kids ? s.kids : s.level === level));
  const typed = level === "hard" && !kids;
  return freshFirst(atLevel, rng, (s) => s.answer, seen)
    .slice(0, SET_LENGTH.emoji)
    .map((s) => ({
      prompt: s.emoji,
      ...(typed ? { accepted: s.keywords } : withChoices(s.answer, atLevel.map((x) => x.answer), rng)),
      answer: s.answer,
      reference: s.reference,
    }));
}

export function buildWhoSaidSet(level: Level, rng: Rng, kids = false, seen?: Seen): SetQuestion[] {
  const atLevel = BIBLE_QUOTES.filter((q) => (kids ? q.kids : q.level === level));
  // Distractor speakers come from every level, so even a short level has variety.
  const speakers = BIBLE_QUOTES.map((q) => q.speaker);
  return freshFirst(atLevel, rng, (q) => `“${q.quote}”`, seen)
    .slice(0, SET_LENGTH.who_said)
    .map((q) => ({ prompt: `“${q.quote}”`, ...withChoices(q.speaker, speakers, rng), answer: q.speaker, reference: q.reference }));
}

/** Words worth blanking: not tiny joining words. */
function blankable(word: string): boolean {
  const bare = word.replace(/[^A-Za-z]/g, "");
  return bare.length >= 4 && !/^(that|with|this|from|your|they|will|shall|have|been|unto|them|then|than|into)$/i.test(bare);
}

/**
 * Easy: one blank, four choices. Medium: two blanks, four choices (pairs).
 * Hard: two blanks, typed.
 */
export function buildVerseFillSet(level: Level, rng: Rng, kids = false, seen?: Seen): SetQuestion[] {
  const blanks = level === "easy" || kids ? 1 : 2;
  const verses = freshFirst(
    PUZZLE_VERSES.filter((v) => tokenize(v.text).filter(blankable).length >= blanks),
    rng,
    (v) => v.reference,
    seen
  ).slice(0, SET_LENGTH.verse_fill);
  const allWords = PUZZLE_VERSES.flatMap((v) => tokenize(v.text).filter(blankable).map((w) => w.replace(/[^A-Za-z']/g, "")));

  return verses.map((v) => {
    const words = tokenize(v.text);
    const candidates = words.map((w, i) => ({ w, i })).filter(({ w }) => blankable(w));
    const picked = shuffle(candidates, rng)
      .slice(0, blanks)
      .sort((a, b) => a.i - b.i);
    const bare = (w: string) => w.replace(/[^A-Za-z']/g, "");
    const prompt = words.map((w, i) => (picked.some((p) => p.i === i) ? w.replace(/[A-Za-z']+/, "_____") : w)).join(" ");
    const answer = picked.map((p) => bare(p.w)).join(" / ");

    if (level === "hard" && !kids) {
      return { prompt, accepted: [normalize(picked.map((p) => bare(p.w)).join(" "))], answer, reference: v.reference };
    }
    const pool = blanks === 1 ? allWords : Array.from({ length: 12 }, () => shuffle(allWords, rng).slice(0, 2).join(" / "));
    return { prompt, ...withChoices(answer, pool, rng), answer, reference: v.reference };
  });
}

/** Is this answer right? Choices: the index. Typed: contains an accepted phrase (exact for verse fill). */
export function isSetAnswerCorrect(question: SetQuestion, answer: number | string, exact = false): boolean {
  if (question.choices) return answer === question.answerIndex;
  if (typeof answer !== "string") return false;
  const given = normalize(answer);
  if (!given) return false;
  return (question.accepted ?? []).some((a) => (exact ? given === normalize(a) : ` ${given} `.includes(` ${normalize(a)} `)));
}

/** What the player is sent: no answers. */
export function setQuestionView(questions: readonly SetQuestion[]) {
  return { questions: questions.map((q) => ({ prompt: q.prompt, choices: q.choices })) };
}

// ---------------------------------------------------------------------------
// Books in order
// ---------------------------------------------------------------------------

export interface BooksPuzzle {
  books: string[];
  section: string | null;
}

/** Easy: 5 books in a row. Medium: 8. Hard: a whole section of 8 or more. */
export function buildBooksOrder(level: Level, rng: Rng): { puzzle: BooksPuzzle; view: { books: string[]; section: string | null } } {
  let books: string[];
  let section: string | null = null;
  if (level === "hard") {
    const big = BIBLE_SECTIONS.filter((s) => s.books.length >= 8);
    const chosen = big[Math.floor(rng() * big.length)];
    books = chosen.books;
    section = chosen.name;
  } else {
    const n = level === "easy" ? 5 : 8;
    const start = Math.floor(rng() * (BIBLE_BOOKS.length - n + 1));
    books = BIBLE_BOOKS.slice(start, start + n);
  }
  let shuffled = shuffle(books, rng);
  for (let i = 0; i < 10 && shuffled.every((b, j) => b === books[j]); i++) shuffled = shuffle(books, rng);
  return { puzzle: { books, section }, view: { books: shuffled, section } };
}

/** Books in the right position. */
export function checkBooksOrder(puzzle: BooksPuzzle, order: readonly string[]): number {
  return puzzle.books.filter((b, i) => order[i] === b).length;
}
