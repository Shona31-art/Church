import { BOOKS, OLD_TESTAMENT_BOOKS, type BookText } from "./books";

// Whole-Bible word search, run in the browser over the static text files.
// Pure logic (no fetching) so it's unit-tested in tests/unit/bible-search.test.ts.
//
// How a query matches:
//   shepherd          verses containing a word starting with "shepherd" (shepherd, shepherds)
//   love one another  verses containing ALL of those words, in any order
//   "my shepherd"     the exact phrase
// Case, accents, curly quotes and the [brackets] marking supplied words are ignored.

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;
export type Testament = "all" | "ot" | "nt";

export interface SearchHit {
  bookIndex: number;
  chapter: number;
  verse: number;
  text: string;
}

/** Lower-case, no accents, straight quotes, no supplied-word brackets. Keeps string length 1:1 where possible. */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[[\]]/g, "")
    .toLowerCase();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The query's terms: quoted phrases kept whole, everything else split into words. */
export function queryTerms(query: string): string[] {
  const terms: string[] = [];
  const q = normalise(query.slice(0, MAX_QUERY_LENGTH));
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const term = (m[1] ?? m[2]).replace(/[^\p{L}\p{N}' -]/gu, "").trim();
    if (term) terms.push(term);
  }
  return terms;
}

export interface Matcher {
  terms: string[];
  /** Does this verse match every term? */
  test(text: string): boolean;
}

/** null when the query has nothing searchable (too short, only punctuation). */
export function buildMatcher(query: string): Matcher | null {
  const terms = queryTerms(query);
  if (!terms.length || terms.join(" ").length < MIN_QUERY_LENGTH) return null;
  // Each term must start at a word boundary ("love" finds "loved", not "glove").
  const patterns = terms.map((t) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t).replace(/ +/g, "\\s+")}`, "u"));
  return {
    terms,
    test: (text) => {
      const n = normalise(text);
      return patterns.every((p) => p.test(n));
    },
  };
}

/** Index ranges [start, end) of every term in the verse, for <mark>ing them. Merged and sorted. */
export function matchRanges(text: string, terms: string[]): [number, number][] {
  const n = normalise(text.replace(/[[\]]/g, ""));
  const ranges: [number, number][] = [];
  for (const t of terms) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(t).replace(/ +/g, "\\s+")}[\\p{L}\\p{N}']*`, "gu");
    for (const m of n.matchAll(re)) ranges.push([m.index!, m.index! + m[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** Book indexes to search for a testament filter. */
export function booksFor(testament: Testament): number[] {
  const all = BOOKS.map((_, i) => i);
  if (testament === "ot") return all.slice(0, OLD_TESTAMENT_BOOKS);
  if (testament === "nt") return all.slice(OLD_TESTAMENT_BOOKS);
  return all;
}

/** Every matching verse in one book, in order. */
export function searchBook(bookIndex: number, book: BookText, matcher: Matcher): SearchHit[] {
  const hits: SearchHit[] = [];
  book.chapters.forEach((verses, c) =>
    verses.forEach((text, v) => {
      if (text && matcher.test(text)) hits.push({ bookIndex, chapter: c + 1, verse: v + 1, text });
    }),
  );
  return hits;
}
