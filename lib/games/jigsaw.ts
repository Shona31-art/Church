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

/** What the AI paints for each built-in story ("Create all six"). */
export const JIGSAW_STORIES: Record<JigsawSceneKey, string> = {
  ark: "Noah's ark resting on calm water after the flood, animals coming out two by two, Noah's family giving thanks, a bright rainbow across the sky (Genesis 9)",
  jonah: "Jonah inside the great fish deep in the sea, praying, with light shining down through the water, a ship sailing on the waves above (Jonah 1–2)",
  star: "The bright star shining over Bethlehem at night, the wise men on camels arriving at the stable, Mary holding baby Jesus inside (Matthew 2)",
  tomb: "The empty tomb on Easter morning at sunrise, the great stone rolled away, women arriving with spices, an angel in white, a garden full of lilies (Matthew 28)",
  sea: "Moses with his staff raised, leading the Israelites — men, women and children with their belongings — on dry ground between two towering walls of water at the Red Sea (Exodus 14)",
  cross: "The cross on the hill of Calvary at sunset, glowing with golden light, a peaceful sky and flowers on the hillside (John 19)",
};

/** Pieces per side, by level. */
export const JIGSAW_SIZE: Record<Level, number> = { easy: 3, medium: 4, hard: 5 };

export const JIGSAW_BUCKET = "jigsaw-pictures";

export interface JigsawPuzzle {
  scene: JigsawSceneKey;
  /** A church picture used instead of the built-in drawing. */
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

/** One-tap ideas on the Jigsaw pictures page: the six stories plus pictures of Jesus. */
export const JIGSAW_PICTURE_IDEAS: { title: string; reference: string; story: string }[] = [
  ...JIGSAW_SCENES.map((s) => ({ title: s.title, reference: s.reference, story: JIGSAW_STORIES[s.key] })),
  { title: "Jesus praying for the world", reference: "John 17:20", story: "Jesus praying with eyes closed and hands folded, the earth glowing beneath his hands, among radiant heavenly clouds and golden light" },
  { title: "Jesus with open arms", reference: "Matthew 11:28", story: "Jesus standing with open arms in radiant light above the clouds, welcoming everyone, rays of golden light behind him" },
  { title: "The Good Shepherd", reference: "John 10:11", story: "Jesus the Good Shepherd carrying a lamb on his shoulders through a green valley with his flock, warm evening light" },
  { title: "Jesus blesses the children", reference: "Mark 10:16", story: "Jesus seated under an olive tree, smiling and blessing a group of happy children of many nations gathered around him" },
];
