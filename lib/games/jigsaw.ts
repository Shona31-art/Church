// Bible picture jigsaw (pure — unit-tested). The picture is cut into a square
// grid of pieces and shuffled; the player swaps pieces until each is home.
// Pictures are original drawings in components/games/JigsawArt.tsx.

import type { Level } from "./catalog";
import { shuffle, type Rng } from "./random";

export const JIGSAW_SCENES = [
  { key: "ark", title: "Noah's ark and the rainbow", reference: "Genesis 9:13" },
  { key: "jonah", title: "Jonah and the great fish", reference: "Jonah 1:17" },
  { key: "star", title: "The star over Bethlehem", reference: "Matthew 2:10" },
  { key: "tomb", title: "The empty tomb at sunrise", reference: "Matthew 28:6" },
  { key: "sea", title: "Moses parts the Red Sea", reference: "Exodus 14:21" },
  { key: "cross", title: "The cross on the hill", reference: "John 3:16" },
] as const;
export type JigsawSceneKey = (typeof JIGSAW_SCENES)[number]["key"];

/** Pieces per side, by level. */
export const JIGSAW_SIZE: Record<Level, number> = { easy: 3, medium: 4, hard: 5 };

export const JIGSAW_BUCKET = "jigsaw-pictures";

export interface JigsawPuzzle {
  scene: JigsawSceneKey;
  /** A church picture (they share the pool with the built-in drawings). */
  pictureId?: string;
  size: number;
  /** order[slot] = the piece shown in that slot at the start. Piece i belongs in slot i. */
  order: number[];
}

export function buildJigsaw(level: Level, rng: Rng): JigsawPuzzle {
  const size = JIGSAW_SIZE[level];
  const scene = JIGSAW_SCENES[Math.floor(rng() * JIGSAW_SCENES.length)].key;
  const pieces = Array.from({ length: size * size }, (_, i) => i);
  // Shuffle until at most a couple of pieces start in their home slot.
  let order = shuffle(pieces, rng);
  for (let tries = 0; tries < 50 && order.filter((p, i) => p === i).length > Math.floor(size / 2); tries++) order = shuffle(pieces, rng);
  return { scene, size, order };
}

/** The fewest swaps that solve a shuffled order (pieces minus cycles). */
export function fewestSwaps(order: readonly number[]): number {
  const seen = new Array<boolean>(order.length).fill(false);
  let cycles = 0;
  for (let i = 0; i < order.length; i++) {
    if (seen[i]) continue;
    cycles++;
    for (let j = i; !seen[j]; j = order[j]) seen[j] = true;
  }
  return order.length - cycles;
}

/**
 * Score for a played jigsaw: replays the swaps from the starting order, counts
 * pieces home, then takes off one piece for every two moves beyond the fewest
 * possible (with a little slack: a quarter more, at least two). A finished
 * jigsaw done with far too many moves can still fail.
 */
export function scoreJigsawSwaps(puzzle: JigsawPuzzle, swaps: readonly (readonly [number, number])[]): number {
  const n = puzzle.size * puzzle.size;
  if (swaps.length > n * 40) return 0;
  let order = [...puzzle.order];
  for (const [a, b] of swaps) {
    if (![a, b].every((i) => Number.isInteger(i) && i >= 0 && i < n)) return 0;
    order = swapPieces(order, a, b);
  }
  const home = order.filter((p, i) => p === i).length;
  const best = fewestSwaps(puzzle.order);
  const slack = Math.max(2, Math.ceil(best / 4));
  const extra = Math.max(0, swaps.length - best - slack);
  return Math.max(0, home - Math.ceil(extra / 2));
}

/** Pieces in their home slot. `arrangement` must be a full arrangement of the pieces, else 0. */
export function checkJigsaw(puzzle: JigsawPuzzle, arrangement: readonly number[]): number {
  const n = puzzle.size * puzzle.size;
  if (arrangement.length !== n) return 0;
  const seen = new Set(arrangement);
  if (seen.size !== n || arrangement.some((p) => !Number.isInteger(p) || p < 0 || p >= n)) return 0;
  return arrangement.filter((p, i) => p === i).length;
}

/** Swaps the pieces in two slots (returns a new arrangement). */
export function swapPieces(arrangement: readonly number[], a: number, b: number): number[] {
  const next = [...arrangement];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
