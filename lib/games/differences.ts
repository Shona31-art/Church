// Spot the difference (pure — unit-tested).
//
// Each game is two copies of a Bible picture drawn from simple shapes. A few
// objects are changed in one copy: taken away, recoloured, resized, moved or
// turned round. The player taps where they see a difference, on either
// picture. Each difference has a "spot" (a circle); a tap inside an unfound
// spot finds it, a tap outside every spot is a wrong tap. Too many wrong taps
// ends the game, so tapping everywhere doesn't work.
//
// Coordinates are in the pictures' own 200 × 150 space.

import type { Level } from "./catalog";
import { shuffle, type Rng } from "./random";

export const PICTURE_WIDTH = 200;
export const PICTURE_HEIGHT = 150;

export type PropKind =
  | "sun" | "moon" | "star" | "cloud" | "tree" | "palm" | "sheep" | "dove" | "bird" | "fish"
  | "boat" | "ark" | "house" | "person" | "flower" | "rainbow" | "basket" | "bread" | "jar"
  | "lamp" | "rock" | "bolt";

export interface PictureObject {
  id: string;
  kind: PropKind;
  /** What to call it in the answers ("the dove"). */
  name: string;
  x: number;
  y: number;
  /** Scale: 1 is the normal size of this kind of thing. */
  s: number;
  color: string;
  flip?: boolean;
}

export type Background = "sea" | "hills" | "night" | "garden" | "storm";

export interface DifferenceScene {
  key: string;
  title: string;
  reference: string;
  background: Background;
  objects: PictureObject[];
}

/** Roughly how far each kind of thing reaches from its centre, at scale 1. */
export const PROP_RADIUS: Record<PropKind, number> = {
  sun: 9, moon: 7, star: 6, cloud: 12, tree: 12, palm: 13, sheep: 9, dove: 7, bird: 5, fish: 7,
  boat: 12, ark: 14, house: 11, person: 9, flower: 6, rainbow: 30, basket: 7, bread: 6, jar: 6,
  lamp: 6, rock: 9, bolt: 8,
};

/** Things that look different when turned round. */
const ASYMMETRIC = new Set<PropKind>(["sheep", "dove", "fish", "boat", "palm", "lamp"]);
/** Things whose colour can change (a rainbow can't). */
const COLOURABLE = new Set<PropKind>(Object.keys(PROP_RADIUS).filter((k) => k !== "rainbow") as PropKind[]);

/** Bright colours that are easy to tell apart, for recolouring. */
const PALETTE = ["#e74c3c", "#f39c12", "#f7dc6f", "#27ae60", "#2e86de", "#8e44ad", "#ffffff", "#5d4037", "#ec7fa9", "#1abc9c", "#2c3e50"];

let n = 0;
const o = (kind: PropKind, name: string, x: number, y: number, s: number, color: string, flip?: boolean): PictureObject => ({
  id: `o${n++}`,
  kind,
  name,
  x,
  y,
  s,
  color,
  ...(flip ? { flip } : {}),
});

/** Original pictures. Objects are listed back to front. */
export const DIFFERENCE_SCENES: DifferenceScene[] = [
  {
    key: "ark",
    title: "Noah's ark",
    reference: "Genesis 8:11; 9:13",
    background: "sea",
    objects: [
      o("rainbow", "rainbow", 100, 52, 2.2, "#ffffff"),
      o("sun", "sun", 172, 22, 1.2, "#f7c948"),
      o("cloud", "left cloud", 38, 22, 1.2, "#ffffff"),
      o("cloud", "small cloud", 128, 16, 0.8, "#ffffff"),
      o("rock", "mountain top", 184, 98, 1.5, "#8d8d8d"),
      o("tree", "olive tree", 184, 80, 0.6, "#6b8e23"),
      o("ark", "ark", 98, 94, 2.1, "#8b5a2b"),
      o("person", "Noah", 98, 72, 0.75, "#6b4fa0"),
      o("sheep", "left sheep", 78, 76, 0.55, "#f5f5f5"),
      o("sheep", "right sheep", 118, 76, 0.55, "#f5f5f5", true),
      o("dove", "dove", 58, 52, 0.9, "#ffffff"),
      o("bird", "raven", 150, 50, 0.9, "#222222"),
      o("bird", "small bird", 24, 58, 0.6, "#333333"),
      o("fish", "orange fish", 36, 122, 0.8, "#f39c12"),
      o("fish", "blue fish", 160, 126, 0.8, "#3498db", true),
      o("fish", "red fish", 96, 138, 0.65, "#e74c3c"),
      o("star", "starfish", 134, 140, 0.6, "#ec7fa9"),
    ],
  },
  {
    key: "shepherd",
    title: "The Good Shepherd",
    reference: "John 10:11; Luke 15:4",
    background: "hills",
    objects: [
      o("sun", "sun", 24, 22, 1.2, "#f7c948"),
      o("cloud", "middle cloud", 82, 20, 1, "#ffffff"),
      o("cloud", "right cloud", 152, 28, 0.8, "#ffffff"),
      o("bird", "high bird", 118, 40, 0.6, "#333333"),
      o("bird", "low bird", 136, 50, 0.5, "#333333"),
      o("tree", "big tree", 172, 72, 1.6, "#2e8b57"),
      o("tree", "small tree", 18, 82, 1.1, "#3c9d5d"),
      o("rock", "rock", 186, 112, 0.9, "#9e9e9e"),
      o("person", "shepherd", 56, 94, 1.4, "#8e5a3c"),
      o("sheep", "sheep by the shepherd", 88, 106, 0.9, "#f5f5f5"),
      o("sheep", "sheep at the top", 122, 96, 0.9, "#f5f5f5", true),
      o("sheep", "sheep on the right", 150, 114, 0.9, "#f5f5f5"),
      o("sheep", "middle sheep", 112, 126, 0.9, "#f5f5f5", true),
      o("sheep", "lamb", 168, 134, 0.6, "#fff8e7"),
      o("sheep", "black sheep", 80, 132, 0.8, "#3b3b3b"),
      o("flower", "red flower", 28, 132, 1, "#e74c3c"),
      o("flower", "yellow flower", 190, 138, 1, "#f7dc6f"),
      o("flower", "purple flower", 136, 142, 1, "#8e44ad"),
      o("flower", "pink flower", 50, 142, 0.9, "#ec7fa9"),
    ],
  },
  {
    key: "bethlehem",
    title: "Born in Bethlehem",
    reference: "Luke 2:7-8; Matthew 2:9",
    background: "night",
    objects: [
      o("star", "bright star", 100, 18, 1.6, "#ffd34d"),
      o("moon", "moon", 172, 24, 1, "#fdf3c4"),
      o("star", "little star on the left", 28, 14, 0.5, "#ffffff"),
      o("star", "star by the cloud", 60, 32, 0.5, "#ffffff"),
      o("star", "star on the right", 142, 12, 0.5, "#ffffff"),
      o("star", "lowest star", 188, 52, 0.5, "#ffffff"),
      o("cloud", "night cloud", 48, 52, 0.8, "#5c6b9c"),
      o("palm", "palm tree", 14, 102, 1.2, "#2e8b57"),
      o("house", "house on the left", 36, 98, 1.1, "#d7b98e"),
      o("house", "house on the right", 168, 94, 1.2, "#e3c9a0"),
      o("house", "stable", 98, 98, 1.6, "#8b5a2b"),
      o("person", "Mary", 82, 112, 0.9, "#3b6fb6"),
      o("person", "Joseph", 116, 110, 0.95, "#8e5a3c"),
      o("basket", "manger", 99, 120, 0.7, "#a0522d"),
      o("lamp", "lamp", 140, 104, 0.6, "#c0392b"),
      o("person", "shepherd", 160, 126, 0.9, "#4f7f3a"),
      o("sheep", "sheep on the left", 58, 132, 0.7, "#f5f5f5"),
      o("sheep", "sheep on the right", 134, 136, 0.7, "#f5f5f5", true),
    ],
  },
  {
    key: "jonah",
    title: "Jonah and the great fish",
    reference: "Jonah 1:15-17",
    background: "sea",
    objects: [
      o("sun", "sun", 186, 16, 0.8, "#f7c948"),
      o("cloud", "left cloud", 30, 20, 1.1, "#d5d8dc"),
      o("cloud", "middle cloud", 100, 16, 1.2, "#d5d8dc"),
      o("cloud", "right cloud", 160, 30, 0.9, "#d5d8dc"),
      o("bird", "gull", 122, 46, 0.6, "#333333"),
      o("bird", "second gull", 142, 40, 0.6, "#333333"),
      o("rock", "island", 186, 96, 1.2, "#a1887f"),
      o("palm", "island palm", 188, 80, 0.8, "#2e8b57"),
      o("boat", "ship", 60, 86, 1.6, "#f5f5f5"),
      o("person", "sailor at the front", 46, 80, 0.55, "#c0392b"),
      o("person", "sailor at the back", 74, 80, 0.55, "#2e86de"),
      o("jar", "cargo jar", 92, 92, 0.5, "#d35400"),
      o("fish", "great fish", 132, 120, 2.2, "#5d6d7e", true),
      o("fish", "little yellow fish", 28, 124, 0.7, "#f1c40f"),
      o("fish", "little red fish", 76, 138, 0.7, "#e74c3c"),
      o("star", "starfish", 186, 140, 0.6, "#ec7fa9"),
    ],
  },
  {
    key: "feeding",
    title: "Five loaves and two fish",
    reference: "John 6:9-13",
    background: "hills",
    objects: [
      o("sun", "sun", 162, 22, 1, "#f7c948"),
      o("cloud", "cloud", 50, 22, 1.1, "#ffffff"),
      o("bird", "bird", 92, 34, 0.6, "#333333"),
      o("tree", "tree", 20, 76, 1.3, "#2e8b57"),
      o("palm", "palm tree", 184, 74, 1.1, "#3c9d5d"),
      o("person", "Jesus", 100, 84, 1.3, "#f4f1e8"),
      o("person", "boy", 128, 96, 0.8, "#d35400"),
      o("person", "woman", 62, 92, 0.9, "#8e44ad"),
      o("bread", "loaf on the left", 58, 108, 0.7, "#d8a657"),
      o("bread", "loaf in the middle", 94, 110, 0.7, "#d8a657"),
      o("fish", "first fish", 116, 112, 0.6, "#95a5a6"),
      o("fish", "second fish", 150, 102, 0.6, "#95a5a6", true),
      o("basket", "basket on the left", 36, 118, 0.8, "#a0522d"),
      o("basket", "basket at the front", 72, 130, 0.8, "#a0522d"),
      o("basket", "middle basket", 128, 130, 0.8, "#a0522d"),
      o("basket", "basket on the right", 164, 120, 0.8, "#a0522d"),
      o("flower", "red flower", 14, 140, 0.9, "#e74c3c"),
      o("flower", "yellow flower", 100, 142, 0.9, "#f7dc6f"),
      o("flower", "white flower", 190, 140, 0.9, "#ffffff"),
    ],
  },
  {
    key: "creation",
    title: "God made the world",
    reference: "Genesis 1:14-25",
    background: "garden",
    objects: [
      o("sun", "sun", 34, 24, 1.3, "#f7c948"),
      o("moon", "moon", 166, 22, 0.9, "#fdf3c4"),
      o("star", "star at the top", 120, 12, 0.5, "#fff6cf"),
      o("star", "middle star", 140, 30, 0.5, "#fff6cf"),
      o("star", "star on the right", 190, 42, 0.5, "#fff6cf"),
      o("bird", "first bird", 80, 38, 0.7, "#333333"),
      o("bird", "second bird", 100, 46, 0.6, "#333333"),
      o("dove", "dove", 150, 60, 0.8, "#ffffff", true),
      o("tree", "tree on the left", 20, 84, 1.2, "#2e8b57"),
      o("tree", "big tree", 96, 76, 1.6, "#3c9d5d"),
      o("palm", "palm tree", 176, 84, 1.2, "#2e8b57"),
      o("fish", "fish in the pond", 38, 128, 0.7, "#f39c12"),
      o("fish", "second fish in the pond", 62, 136, 0.6, "#e74c3c", true),
      o("sheep", "sheep", 132, 112, 0.8, "#f5f5f5"),
      o("rock", "rock", 190, 118, 0.8, "#9e9e9e"),
      o("flower", "red flower", 90, 140, 0.9, "#e74c3c"),
      o("flower", "purple flower", 152, 140, 0.9, "#8e44ad"),
      o("flower", "yellow flower", 176, 132, 0.9, "#f7dc6f"),
      o("flower", "pink flower", 112, 132, 0.8, "#ec7fa9"),
    ],
  },
  {
    key: "storm",
    title: "Jesus calms the storm",
    reference: "Mark 4:37-39",
    background: "storm",
    objects: [
      o("cloud", "far-left cloud", 24, 20, 1.1, "#7f8c8d"),
      o("cloud", "left cloud", 76, 14, 1.2, "#7f8c8d"),
      o("cloud", "right cloud", 132, 22, 1.1, "#7f8c8d"),
      o("cloud", "far-right cloud", 180, 16, 1, "#7f8c8d"),
      o("bolt", "left lightning", 52, 44, 0.9, "#f7dc6f"),
      o("bolt", "right lightning", 158, 46, 0.8, "#f7dc6f"),
      o("bird", "bird in the storm", 182, 62, 0.5, "#ecf0f1"),
      o("rock", "rock", 14, 104, 1, "#7b7d7d"),
      o("boat", "boat", 100, 94, 2, "#f5f5f5"),
      o("person", "disciple at the front", 82, 80, 0.7, "#c0392b"),
      o("person", "Jesus", 104, 82, 0.7, "#f4f1e8"),
      o("person", "disciple at the back", 122, 80, 0.7, "#2e86de"),
      o("lamp", "lamp", 140, 92, 0.5, "#d35400"),
      o("fish", "fish on the left", 38, 132, 0.7, "#95a5a6"),
      o("fish", "fish on the right", 168, 136, 0.7, "#f39c12", true),
    ],
  },
];

export const DIFFERENCE_LEVELS: Record<Level, { count: number; mistakes: number; changes: Change[]; minRadius: number; resize: number }> = {
  easy: { count: 3, mistakes: 5, changes: ["missing", "colour"], minRadius: 7, resize: 1.5 },
  medium: { count: 5, mistakes: 4, changes: ["missing", "colour", "size", "flip"], minRadius: 5, resize: 1.45 },
  hard: { count: 7, mistakes: 3, changes: ["missing", "colour", "size", "flip", "moved"], minRadius: 3, resize: 1.3 },
};

export type Change = "missing" | "colour" | "size" | "flip" | "moved";

export interface Spot {
  x: number;
  y: number;
  r: number;
  /** For the answers, e.g. "The dove is missing from the right-hand picture". */
  label: string;
}

export interface DifferencePuzzle {
  scene: string;
  left: PictureObject[];
  right: PictureObject[];
  spots: Spot[];
  mistakes: number;
}

const TAP_TOLERANCE = 3;
const radiusOf = (obj: PictureObject) => PROP_RADIUS[obj.kind] * obj.s;
const cap = (text: string) => text[0].toUpperCase() + text.slice(1);

/**
 * Where the two pictures differ, worked out from the pictures themselves (so
 * the board can show found spots without being sent an answer list).
 */
export function differenceSpots(left: readonly PictureObject[], right: readonly PictureObject[]): Spot[] {
  const spots: Spot[] = [];
  const rightById = new Map(right.map((r) => [r.id, r]));
  const leftIds = new Set(left.map((l) => l.id));
  for (const a of left) {
    const b = rightById.get(a.id);
    const name = `the ${a.name}`;
    if (!b) {
      spots.push({ x: a.x, y: a.y, r: radiusOf(a) + TAP_TOLERANCE, label: `${cap(name)} is missing from the right-hand picture` });
    } else if (a.x !== b.x || a.y !== b.y) {
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      spots.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: dist / 2 + Math.max(radiusOf(a), radiusOf(b)) + TAP_TOLERANCE, label: `${cap(name)} has moved` });
    } else if (a.s !== b.s) {
      spots.push({ x: a.x, y: a.y, r: Math.max(radiusOf(a), radiusOf(b)) + TAP_TOLERANCE, label: `${cap(name)} is a different size` });
    } else if (a.color !== b.color) {
      spots.push({ x: a.x, y: a.y, r: radiusOf(a) + TAP_TOLERANCE, label: `${cap(name)} is a different colour` });
    } else if (Boolean(a.flip) !== Boolean(b.flip)) {
      spots.push({ x: a.x, y: a.y, r: radiusOf(a) + TAP_TOLERANCE, label: `${cap(name)} faces the other way` });
    }
  }
  for (const b of right) {
    if (!leftIds.has(b.id)) spots.push({ x: b.x, y: b.y, r: radiusOf(b) + TAP_TOLERANCE, label: `${cap(`the ${b.name}`)} is missing from the left-hand picture` });
  }
  return spots;
}

function changeFor(obj: PictureObject, change: Change, level: Level, rng: Rng): PictureObject | null {
  const rule = DIFFERENCE_LEVELS[level];
  switch (change) {
    case "missing":
      return null;
    case "colour": {
      const options = PALETTE.filter((c) => c.toLowerCase() !== obj.color.toLowerCase());
      return { ...obj, color: options[Math.floor(rng() * options.length)] };
    }
    case "size":
      return { ...obj, s: Math.round(obj.s * (rng() < 0.5 ? rule.resize : 1 / rule.resize) * 100) / 100 };
    case "flip":
      return { ...obj, flip: !obj.flip };
    case "moved": {
      // Move sideways by 12–17, staying wholly inside the picture (try the other way if needed).
      const step = 12 + Math.floor(rng() * 6);
      const r = radiusOf(obj);
      const inside = (x: number) => x - r >= 0 && x + r <= PICTURE_WIDTH;
      const first = rng() < 0.5 ? -step : step;
      const x = [obj.x + first, obj.x - first].find(inside);
      return x === undefined ? null : { ...obj, x };
    }
  }
}

function fits(obj: PictureObject, change: Change): boolean {
  if (change === "flip") return ASYMMETRIC.has(obj.kind);
  if (change === "colour") return COLOURABLE.has(obj.kind);
  return true;
}

/** A spot-the-difference game: one of the pictures with `count` changes in it. */
export function buildDifferences(level: Level, rng: Rng): DifferencePuzzle {
  const rule = DIFFERENCE_LEVELS[level];
  const scene = DIFFERENCE_SCENES[Math.floor(rng() * DIFFERENCE_SCENES.length)];
  const left = scene.objects.map((obj) => ({ ...obj }));
  const right = scene.objects.map((obj) => ({ ...obj }));
  const chosen: Spot[] = [];

  const candidates = shuffle(
    scene.objects.filter((obj) => obj.kind !== "rainbow" && radiusOf(obj) >= rule.minRadius && radiusOf(obj) <= 22),
    rng
  );
  for (const obj of candidates) {
    if (chosen.length >= rule.count) break;
    const change = shuffle(rule.changes, rng).find((c) => fits(obj, c))!;
    const changed = changeFor(obj, change, level, rng);
    if (!changed && change !== "missing") continue; // couldn't move it without leaving the picture
    // Missing things are taken from either picture.
    const side = change === "missing" && rng() < 0.5 ? left : right;
    const trialLeft = side === left && !changed ? left.filter((l) => l.id !== obj.id) : left;
    const trialRight = side === right ? (changed ? right.map((r) => (r.id === obj.id ? changed : r)) : right.filter((r) => r.id !== obj.id)) : right;
    const [spot] = differenceSpots(trialLeft.filter((l) => l.id === obj.id), trialRight.filter((r) => r.id === obj.id));
    if (!spot) continue;
    // Keep differences apart, so every tap clearly means one of them.
    if (chosen.some((c) => Math.hypot(c.x - spot.x, c.y - spot.y) < (c.r + spot.r) * 0.85)) continue;
    chosen.push(spot);
    left.splice(0, left.length, ...trialLeft);
    right.splice(0, right.length, ...trialRight);
  }
  return { scene: scene.key, left, right, spots: differenceSpots(left, right), mistakes: rule.mistakes };
}

export interface TapResult {
  found: number[];
  mistakes: number;
  /** For each tap: the spot it found, -1 for a wrong tap, null if it changed nothing (or came after the game ended). */
  taps: (number | null)[];
  over: boolean;
}

/**
 * Plays the taps in order. A tap inside an unfound spot finds the nearest
 * one; inside an already-found spot does nothing; anywhere else is a wrong
 * tap. Once the wrong taps reach the limit, or everything is found, later
 * taps don't count.
 */
export function markTaps(spots: readonly Spot[], taps: readonly (readonly [number, number])[], mistakesAllowed: number): TapResult {
  const found = new Set<number>();
  let mistakes = 0;
  const results: (number | null)[] = [];
  for (const [x, y] of taps) {
    if (mistakes >= mistakesAllowed || found.size === spots.length) {
      results.push(null);
      continue;
    }
    let best = -1;
    let bestDist = Infinity;
    let inAny = false;
    spots.forEach((s, i) => {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > s.r) return;
      inAny = true;
      if (!found.has(i) && d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    if (best >= 0) {
      found.add(best);
      results.push(best);
    } else if (inAny) {
      results.push(null);
    } else {
      mistakes++;
      results.push(-1);
    }
  }
  return { found: [...found], mistakes, taps: results, over: mistakes >= mistakesAllowed || found.size === spots.length };
}

export function checkDifferences(puzzle: DifferencePuzzle, taps: readonly (readonly [number, number])[]): number {
  return markTaps(puzzle.spots, taps, puzzle.mistakes).found.length;
}

export function differenceScene(key: string): DifferenceScene | undefined {
  return DIFFERENCE_SCENES.find((s) => s.key === key);
}
