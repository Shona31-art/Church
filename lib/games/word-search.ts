// Word search: seeded grid generation and answer checking (pure — unit-tested).

import type { Level } from "./catalog";
import { type Rng, shuffle } from "./random";

export const WORD_SEARCH_WORDS = [
  "MOSES", "NOAH", "DAVID", "GOLIATH", "SAMSON", "DANIEL", "JONAH", "ESTHER", "RUTH", "ABRAHAM",
  "SARAH", "JACOB", "JOSEPH", "ISAAC", "ELIJAH", "PETER", "PAUL", "MARY", "JESUS", "JOHN",
  "MATTHEW", "LUKE", "ADAM", "EVE", "SOLOMON", "SAMUEL", "JERICHO", "BETHLEHEM", "NAZARETH",
  "JERUSALEM", "EGYPT", "SINAI", "CANAAN", "GALILEE", "GIDEON", "DEBORAH", "NEHEMIAH", "TIMOTHY",
  "LYDIA", "MARTHA", "LAZARUS", "ZACCHAEUS", "BARNABAS", "JORDAN", "EDEN", "ARK", "MANNA",
  "PSALMS", "GENESIS", "EXODUS", "PROVERBS", "ISAIAH", "ROMANS", "GRACE", "FAITH", "HOPE", "PRAYER",
];

type Direction = [dRow: number, dCol: number];

const DIRECTIONS: Record<Level, Direction[]> = {
  easy: [[0, 1], [1, 0]],
  medium: [[0, 1], [1, 0], [1, 1], [1, -1]],
  // Hard adds the reverse of every direction: words can read backwards.
  hard: [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]],
};

export const WORD_SEARCH_LEVELS: Record<Level, { size: number; words: number }> = {
  easy: { size: 8, words: 5 },
  medium: { size: 12, words: 8 },
  hard: { size: 15, words: 10 },
};

export interface PlacedWord {
  word: string;
  start: [number, number];
  end: [number, number];
}

export interface WordSearchPuzzle {
  size: number;
  grid: string[][];
  words: PlacedWord[];
}

export function buildWordSearch(level: Level, rng: Rng): WordSearchPuzzle {
  const { size, words: wanted } = WORD_SEARCH_LEVELS[level];
  const directions = DIRECTIONS[level];
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
  const placed: PlacedWord[] = [];

  for (const word of shuffle(WORD_SEARCH_WORDS.filter((w) => w.length <= size), rng)) {
    if (placed.length === wanted) break;
    for (let attempt = 0; attempt < 80; attempt++) {
      const [dr, dc] = directions[Math.floor(rng() * directions.length)];
      const row = Math.floor(rng() * size);
      const col = Math.floor(rng() * size);
      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
      let fits = true;
      for (let i = 0; i < word.length && fits; i++) {
        const cell = grid[row + dr * i][col + dc * i];
        if (cell !== null && cell !== word[i]) fits = false;
      }
      if (!fits) continue;
      for (let i = 0; i < word.length; i++) grid[row + dr * i][col + dc * i] = word[i];
      placed.push({ word, start: [row, col], end: [endRow, endCol] });
      break;
    }
  }

  const letters = "ABCDEFGHIJKLMNOPRSTUWY"; // filler avoids rare letters that make words stand out
  return {
    size,
    grid: grid.map((r) => r.map((cell) => cell ?? letters[Math.floor(rng() * letters.length)])),
    words: placed,
  };
}

export interface WordSearchFind {
  word: string;
  start: [number, number];
  end: [number, number];
}

/**
 * How many listed words were correctly marked: the letters along the marked
 * line (either direction) must spell the word. Duplicates count once.
 */
export function checkWordSearch(puzzle: WordSearchPuzzle, finds: readonly WordSearchFind[]): number {
  const listed = new Set(puzzle.words.map((w) => w.word));
  const found = new Set<string>();
  for (const f of finds) {
    if (!listed.has(f.word)) continue;
    const letters = lettersBetween(puzzle.grid, f.start, f.end);
    if (letters && (letters === f.word || [...letters].reverse().join("") === f.word)) found.add(f.word);
  }
  return found.size;
}

/** The letters along a straight line between two cells, or null if it isn't straight. */
export function lettersBetween(grid: string[][], start: [number, number], end: [number, number]): string | null {
  // Answers come from the browser: refuse anything off the grid before looping.
  const inside = (n: number) => Number.isInteger(n) && n >= 0 && n < grid.length;
  if (![...start, ...end].every(inside)) return null;
  const dr = Math.sign(end[0] - start[0]);
  const dc = Math.sign(end[1] - start[1]);
  const steps = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]));
  const straight = start[0] === end[0] || start[1] === end[1] || Math.abs(end[0] - start[0]) === Math.abs(end[1] - start[1]);
  if (!straight) return null;
  let out = "";
  for (let i = 0; i <= steps; i++) out += grid[start[0] + dr * i]?.[start[1] + dc * i] ?? "";
  return out;
}
