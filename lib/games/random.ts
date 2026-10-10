// Seeded randomness for games (pure — unit-tested).
//
// A puzzle is built from a seed number, so the same seed always gives the
// same puzzle: that's what lets the daily challenge show every member the
// same grid, and makes generators testable. Not for anything security-related.

export type Rng = () => number;

/** mulberry32: tiny, fast, good enough for shuffling puzzle pieces. Returns [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole number in [min, max]. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A fresh seed for a practice game. */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
