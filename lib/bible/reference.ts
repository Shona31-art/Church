import { BOOKS } from "./books";

// Understands what people type into the "go to" box: "John 3:16", "jn 3",
// "1 cor 13:4-7", "I John 4.8", "psalm 23", "Song of Songs 2". Pure logic,
// shared by server and client, unit-tested in tests/unit/bible-reference.test.ts.

export interface Reference {
  bookIndex: number;
  chapter: number;
  verse?: number;
  /** Last verse of a range ("13:4-7" → 7). */
  verseEnd?: number;
}

/** "1 Samuel", "1sam", "I Sam." → "1samuel", "1sam", "1sam" */
function compact(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(iii|third|3rd)\b/, "3")
    .replace(/^(ii|second|2nd)\b/, "2")
    .replace(/^(i|first|1st)\b/, "1")
    .replace(/[^a-z0-9]/g, "");
}

const BOOK_KEYS = new Map<string, number>();
BOOKS.forEach((b, i) => {
  BOOK_KEYS.set(compact(b.name), i);
  for (const a of b.abbr) BOOK_KEYS.set(compact(a), i);
});

/**
 * Finds a book from what someone typed. Exact names and abbreviations win;
 * otherwise a prefix that matches exactly one book ("phile" → Philemon).
 * Ambiguous prefixes ("jo" — Job, Joel, John, Jonah…) return -1.
 */
export function findBook(text: string): number {
  const key = compact(text);
  if (!key) return -1;
  const exact = BOOK_KEYS.get(key);
  if (exact !== undefined) return exact;
  const matches = BOOKS.map((b, i) => (compact(b.name).startsWith(key) ? i : -1)).filter((i) => i >= 0);
  return matches.length === 1 ? matches[0] : -1;
}

/** Books whose name starts with what's typed — for filtering the book list as people type. */
export function booksMatching(text: string): number[] {
  const key = compact(text);
  if (!key) return BOOKS.map((_, i) => i);
  return BOOKS.map((b, i) => i).filter(
    (i) => compact(BOOKS[i].name).startsWith(key) || BOOKS[i].abbr.some((a) => compact(a) === key),
  );
}

// book part (may start with a number: "1 cor"), then optional chapter, then optional :verse or .verse, then optional -end
const REFERENCE = /^\s*((?:[1-3]|iii|ii|i|first|second|third|1st|2nd|3rd)?\s*[a-z][a-z.\s]*?)\s*(\d+)?(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i;

/**
 * Parses a typed reference. Returns null if the book isn't recognised or the
 * chapter doesn't exist. A book on its own means chapter 1. Verse numbers
 * aren't checked here (that needs the text); the reader clamps them.
 */
export function parseReference(input: string): Reference | null {
  const m = REFERENCE.exec(input);
  if (!m) return null;
  const bookIndex = findBook(m[1]);
  if (bookIndex < 0) return null;

  // One-chapter books are cited by verse alone: "Jude 24" means Jude 1:24.
  if (BOOKS[bookIndex].chapters === 1 && m[2] && !m[3] && Number(m[2]) > 1) {
    return { bookIndex, chapter: 1, verse: Number(m[2]) };
  }

  const chapter = m[2] ? Number(m[2]) : 1;
  if (chapter < 1 || chapter > BOOKS[bookIndex].chapters) return null;

  const ref: Reference = { bookIndex, chapter };
  if (m[3]) {
    const verse = Number(m[3]);
    if (verse < 1) return null;
    ref.verse = verse;
    if (m[4] && Number(m[4]) > verse) ref.verseEnd = Number(m[4]);
  }
  return ref;
}

/** { John, 3, 16, 18 } → "John 3:16-18" */
export function formatReference({ bookIndex, chapter, verse, verseEnd }: Reference): string {
  let text = `${BOOKS[bookIndex].name} ${chapter}`;
  if (verse) text += `:${verse}`;
  if (verse && verseEnd && verseEnd > verse) text += `-${verseEnd}`;
  return text;
}
