// Verse Puzzle (ported from the Android app): unscramble a verse's words back
// into order. Verses are World English Bible text, which is public domain, so
// embedding them here carries no licensing risk and the game works offline.

export interface PuzzleVerse {
  reference: string;
  text: string;
}

export const PUZZLE_VERSES: PuzzleVerse[] = [
  { reference: "John 11:35", text: "Jesus wept." },
  { reference: "Psalm 23:1", text: "Yahweh is my shepherd; I shall lack nothing." },
  { reference: "Philippians 4:13", text: "I can do all things through Christ, who strengthens me." },
  { reference: "Psalm 118:24", text: "This is the day that Yahweh has made. We will rejoice and be glad in it!" },
  { reference: "Proverbs 3:5", text: "Trust in Yahweh with all your heart, and don't lean on your own understanding." },
  { reference: "Matthew 5:9", text: "Blessed are the peacemakers, for they shall be called children of God." },
  { reference: "1 John 4:19", text: "We love him, because he first loved us." },
  { reference: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { reference: "Hebrews 13:8", text: "Jesus Christ is the same yesterday, today, and forever." },
  { reference: "Romans 12:12", text: "rejoicing in hope; enduring in troubles; continuing steadfastly in prayer;" },
  { reference: "Isaiah 40:8", text: "The grass withers, the flower fades; but the word of our God stands forever." },
  { reference: "Matthew 5:14", text: "You are the light of the world. A city located on a hill can't be hidden." },
  { reference: "Psalm 119:105", text: "Your word is a lamp to my feet, and a light for my path." },
  { reference: "1 Thessalonians 5:16", text: "Always rejoice." },
  { reference: "Galatians 6:2", text: "Bear one another's burdens, and so fulfill the law of Christ." },
  { reference: "James 4:8", text: "Draw near to God, and he will draw near to you." },
  { reference: "Joshua 1:9", text: "Be strong and courageous. Don't be afraid. Don't be dismayed, for Yahweh your God is with you wherever you go." },
  { reference: "John 14:6", text: "Jesus said to him, I am the way, the truth, and the life." },
];

/** Splits verse text into words, keeping punctuation attached to its word. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Returns an order of indices that is guaranteed to differ from the original
 * whenever that's possible (a 1-word verse can't be scrambled). `random` is
 * injectable for deterministic tests.
 */
export function scrambleOrder(length: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  if (length < 2) return order;
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((v, i) => v !== i)) return order;
  }
  // Pathological RNG — fall back to a simple rotation, which always differs.
  return order.map((_, i) => (i + 1) % length);
}

/**
 * Compares by word text, not by index — some verses repeat a word ("Don't …
 * Don't …"), and swapping two identical words is still a correct answer.
 */
export function isCorrectOrder(original: string[], attempt: string[]): boolean {
  return original.length === attempt.length && original.every((w, i) => w === attempt[i]);
}

/** Picks `count` distinct verses for one round (short verses excluded — nothing to unscramble). */
export function pickRound(count: number, random: () => number = Math.random): PuzzleVerse[] {
  const playable = PUZZLE_VERSES.filter((v) => tokenize(v.text).length >= 4);
  const pool = [...playable];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
