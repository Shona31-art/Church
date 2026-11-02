// Crossword: seeded grid building, numbering and marking (pure — unit-tested).
//
// Words are laid on a large canvas one at a time, each crossing at least one
// word already placed. A letter may only touch another letter where two words
// cross, so no accidental extra "words" appear. The result is cropped and
// numbered the usual way (left-to-right, top-to-bottom).

import type { Level } from "./catalog";
import { CROSSWORD_CLUES, type CrosswordClue } from "./content/crossword-clues";
import { createRng, shuffle, type Rng } from "./random";
import { STAGE_COUNT, stageLevel, stageSeed } from "./stages";

export type Direction = "across" | "down";

export interface CrosswordEntry {
  number: number;
  direction: Direction;
  row: number;
  col: number;
  answer: string;
  clue: string;
  reference: string;
}

export interface CrosswordPuzzle {
  width: number;
  height: number;
  entries: CrosswordEntry[];
}

/** `maxSide` keeps grids small enough to tap comfortably on a phone. */
export const CROSSWORD_LEVELS: Record<Level, { target: number; pool: Level[]; maxSide: number }> = {
  easy: { target: 6, pool: ["easy"], maxSide: 13 },
  medium: { target: 9, pool: ["medium", "easy"], maxSide: 15 },
  hard: { target: 12, pool: ["hard", "medium"], maxSide: 17 },
};

const CANVAS = 40;

interface Placed {
  clue: CrosswordClue;
  row: number;
  col: number;
  direction: Direction;
}

function step(direction: Direction): [number, number] {
  return direction === "across" ? [0, 1] : [1, 0];
}

/**
 * Lays out as many of `words` as fit, each crossing the grid built so far,
 * within a `maxSide` square. Prefers placements with more crossings, then
 * ones that keep the grid compact.
 */
function layOut(words: CrosswordClue[], target: number, maxSide: number, rng: Rng): Placed[] {
  const letters = new Map<string, string>();
  const box = { minR: Infinity, minC: Infinity, maxR: -Infinity, maxC: -Infinity };
  const used = new Map<string, Set<Direction>>(); // which directions already run through a cell
  const at = (r: number, c: number) => letters.get(`${r},${c}`);
  const placed: Placed[] = [];

  function fit(answer: string, row: number, col: number, direction: Direction): number {
    const [dr, dc] = step(direction);
    const [pr, pc] = [dc, dr]; // perpendicular
    if (row < 0 || col < 0 || row + dr * (answer.length - 1) >= CANVAS || col + dc * (answer.length - 1) >= CANVAS) return -1;
    if (at(row - dr, col - dc) !== undefined || at(row + dr * answer.length, col + dc * answer.length) !== undefined) return -1;
    let crossings = 0;
    for (let i = 0; i < answer.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const existing = at(r, c);
      if (existing !== undefined) {
        if (existing !== answer[i] || used.get(`${r},${c}`)?.has(direction)) return -1;
        crossings++;
      } else if (at(r + pr, c + pc) !== undefined || at(r - pr, c - pc) !== undefined) {
        return -1; // would sit alongside another word's letter
      }
    }
    return crossings;
  }

  /** Height × width of the grid if this word were added, or null if it would be too big. */
  function areaWith(answer: string, row: number, col: number, direction: Direction): number | null {
    const [dr, dc] = step(direction);
    const minR = Math.min(box.minR, row);
    const minC = Math.min(box.minC, col);
    const maxR = Math.max(box.maxR, row + dr * (answer.length - 1));
    const maxC = Math.max(box.maxC, col + dc * (answer.length - 1));
    const h = maxR - minR + 1;
    const w = maxC - minC + 1;
    return h > maxSide || w > maxSide ? null : h * w;
  }

  function put(clue: CrosswordClue, row: number, col: number, direction: Direction) {
    const [dr, dc] = step(direction);
    box.minR = Math.min(box.minR, row);
    box.minC = Math.min(box.minC, col);
    box.maxR = Math.max(box.maxR, row + dr * (clue.answer.length - 1));
    box.maxC = Math.max(box.maxC, col + dc * (clue.answer.length - 1));
    for (let i = 0; i < clue.answer.length; i++) {
      const key = `${row + dr * i},${col + dc * i}`;
      letters.set(key, clue.answer[i]);
      used.set(key, (used.get(key) ?? new Set()).add(direction));
    }
    placed.push({ clue, row, col, direction });
  }

  const ordered = [...words].filter((w) => w.answer.length <= maxSide).sort((a, b) => b.answer.length - a.answer.length);
  // Start from a mid-length word: the longest ones make sprawling grids.
  const first = ordered[Math.floor(ordered.length / 3)];
  const rest = ordered.filter((w) => w !== first);
  if (!first) return placed;
  put(first, Math.floor(CANVAS / 2), Math.floor((CANVAS - first.answer.length) / 2), "across");

  for (const word of rest) {
    if (placed.length >= target) break;
    let best: { row: number; col: number; direction: Direction }[] = [];
    let bestKey: [number, number] = [0, Infinity]; // [crossings, area]
    for (const p of placed) {
      const [pdr, pdc] = step(p.direction);
      const direction: Direction = p.direction === "across" ? "down" : "across";
      const [dr, dc] = step(direction);
      for (let i = 0; i < p.clue.answer.length; i++) {
        for (let j = 0; j < word.answer.length; j++) {
          if (p.clue.answer[i] !== word.answer[j]) continue;
          const row = p.row + pdr * i - dr * j;
          const col = p.col + pdc * i - dc * j;
          const crossings = fit(word.answer, row, col, direction);
          if (crossings < 1) continue;
          const area = areaWith(word.answer, row, col, direction);
          if (area === null) continue;
          if (crossings > bestKey[0] || (crossings === bestKey[0] && area < bestKey[1])) {
            bestKey = [crossings, area];
            best = [];
          }
          if (crossings === bestKey[0] && area === bestKey[1]) best.push({ row, col, direction });
        }
      }
    }
    if (best.length) {
      const choice = best[Math.floor(rng() * best.length)];
      put(word, choice.row, choice.col, choice.direction);
    }
  }
  return placed;
}

/** Crops to the used area and numbers entries in reading order. */
function finish(placed: Placed[]): CrosswordPuzzle {
  const cells = placed.flatMap((p) => {
    const [dr, dc] = step(p.direction);
    return [...p.clue.answer].map((_, i) => [p.row + dr * i, p.col + dc * i]);
  });
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));

  const starts = [...new Set(placed.map((p) => `${p.row - minR},${p.col - minC}`))]
    .map((key) => key.split(",").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numberAt = new Map(starts.map(([r, c], i) => [`${r},${c}`, i + 1]));

  const entries = placed
    .map((p) => {
      const row = p.row - minR;
      const col = p.col - minC;
      return { number: numberAt.get(`${row},${col}`)!, direction: p.direction, row, col, answer: p.clue.answer, clue: p.clue.clue, reference: p.clue.reference };
    })
    .sort((a, b) => (a.direction === b.direction ? a.number - b.number : a.direction === "across" ? -1 : 1));

  return { width: maxC - minC + 1, height: maxR - minR + 1, entries };
}

/**
 * A crossword for this level. Tries a few layouts from the same seed and
 * keeps the one that fits the most words, so it's still deterministic.
 */
export function buildCrossword(level: Level, seed: number, clues: readonly CrosswordClue[] = CROSSWORD_CLUES): CrosswordPuzzle {
  const { pool } = CROSSWORD_LEVELS[level];
  return finish(bestLayout(level, seed, clues.filter((c) => pool.includes(c.level))));
}

function bestLayout(level: Level, seed: number, candidates: readonly CrosswordClue[]): Placed[] {
  const { target, maxSide } = CROSSWORD_LEVELS[level];
  let best: Placed[] = [];
  for (let attempt = 0; attempt < 12 && best.length < target; attempt++) {
    const rng = createRng(seed + attempt * 7919);
    const placed = layOut(shuffle(candidates, rng), target, maxSide, rng);
    if (placed.length > best.length) best = placed;
  }
  return best;
}

const LEVEL_ORDER: Level[] = ["easy", "medium", "hard"];
const stageCache = new Map<number, CrosswordPuzzle>();

/**
 * The crossword for numbered level `stage` (1–100). Levels are dealt in order
 * from one shared clue bank, and a clue used by one level is never used by
 * another, so every level has its own questions. Each level takes clues of
 * its own difficulty first; only if those can't fill the grid does it also
 * use clues left over from easier levels. Pure and deterministic (cached).
 */
export function buildStageCrossword(stage: number, clues: readonly CrosswordClue[] = CROSSWORD_CLUES): CrosswordPuzzle {
  const useCache = clues === CROSSWORD_CLUES;
  if (useCache && stageCache.has(stage)) return stageCache.get(stage)!;

  const used = new Set<string>();
  let result: CrosswordPuzzle | null = null;
  for (let s = 1; s <= Math.min(stage, STAGE_COUNT); s++) {
    const level = stageLevel(s);
    const seed = stageSeed("crossword", s);
    const unused = clues.filter((c) => !used.has(c.answer));
    let best = bestLayout(level, seed, unused.filter((c) => c.level === level));
    if (best.length < CROSSWORD_LEVELS[level].target) {
      const easier = LEVEL_ORDER.slice(0, LEVEL_ORDER.indexOf(level) + 1);
      const wider = bestLayout(level, seed, unused.filter((c) => easier.includes(c.level)));
      if (wider.length > best.length) best = wider;
    }
    for (const p of best) used.add(p.clue.answer);
    const puzzle = finish(best);
    if (useCache) stageCache.set(s, puzzle);
    if (s === stage) result = puzzle;
  }
  return result!;
}

/** Every entry's cells, for marking and for the board. */
export function entryCells(entry: Pick<CrosswordEntry, "row" | "col" | "direction">, length: number): [number, number][] {
  const [dr, dc] = step(entry.direction);
  return Array.from({ length }, (_, i) => [entry.row + dr * i, entry.col + dc * i]);
}

/**
 * How many entries are filled in correctly. `grid` is the player's letters,
 * one string per row (anything that isn't A–Z counts as blank).
 */
export function checkCrossword(puzzle: CrosswordPuzzle, grid: readonly string[]): number {
  return puzzle.entries.filter((e) =>
    entryCells(e, e.answer.length).every(([r, c], i) => (grid[r]?.[c] ?? "").toUpperCase() === e.answer[i])
  ).length;
}

export { CROSSWORD_HINTS } from "./crossword-hints";

/** The correct letter at a square, or null if the square isn't part of the puzzle. */
export function crosswordLetterAt(puzzle: CrosswordPuzzle, row: number, col: number): string | null {
  for (const e of puzzle.entries) {
    const i = entryCells(e, e.answer.length).findIndex(([r, c]) => r === row && c === col);
    if (i >= 0) return e.answer[i].toUpperCase();
  }
  return null;
}
