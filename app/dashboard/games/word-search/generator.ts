// Procedural word search grid generator. Runs client-side so a fresh
// puzzle is generated every play with no server round-trip needed.

export const BIBLE_WORDS = [
  "MOSES", "NOAH", "DAVID", "GOLIATH", "SAMSON", "DANIEL", "JONAH", "ESTHER",
  "RUTH", "ABRAHAM", "SARAH", "JACOB", "JOSEPH", "ISAAC", "ELIJAH", "PETER",
  "PAUL", "MARY", "JESUS", "JOHN", "MATTHEW", "LUKE", "ADAM", "EVE",
  "SOLOMON", "SAMUEL", "JERICHO", "BETHLEHEM", "NAZARETH", "JERUSALEM",
  "EGYPT", "SINAI", "CANAAN", "GALILEE",
];

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  dRow: number;
  dCol: number;
}

export interface WordSearchPuzzle {
  grid: string[][];
  words: PlacedWord[];
}

const DIRECTIONS = [
  { dRow: 0, dCol: 1 },   // right
  { dRow: 1, dCol: 0 },   // down
  { dRow: 1, dCol: 1 },   // diagonal down-right
  { dRow: 1, dCol: -1 },  // diagonal down-left
];

export function generatePuzzle(size: number = 12, wordCount: number = 8): WordSearchPuzzle {
  const words = [...BIBLE_WORDS]
    .sort(() => Math.random() - 0.5)
    .filter((w) => w.length <= size)
    .slice(0, wordCount);

  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placed: PlacedWord[] = [];

  for (const word of words) {
    let attempts = 0;
    let ok = false;

    while (attempts < 50 && !ok) {
      attempts++;
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);

      const endRow = row + dir.dRow * (word.length - 1);
      const endCol = col + dir.dCol * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const r = row + dir.dRow * i;
        const c = col + dir.dCol * i;
        const existing = grid[r][c];
        if (existing !== null && existing !== word[i]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;

      for (let i = 0; i < word.length; i++) {
        const r = row + dir.dRow * i;
        const c = col + dir.dCol * i;
        grid[r][c] = word[i];
      }
      placed.push({ word, row, col, dRow: dir.dRow, dCol: dir.dCol });
      ok = true;
    }
    // If a word couldn't be placed after 50 tries, it's just skipped —
    // rare with a 12x12 grid and 8 words, and better than an infinite loop.
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const finalGrid: string[][] = grid.map((row) =>
    row.map((cell) => cell ?? letters[Math.floor(Math.random() * letters.length)])
  );

  return { grid: finalGrid, words: placed };
}
