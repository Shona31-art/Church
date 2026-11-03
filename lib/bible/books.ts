import canon from "./canon.json";

// The 66-book Protestant canon, in order. canon.json is shared with
// scripts/build-bibles.mjs, which names the text files after `slug`.
// `name` is also what bible_bookmarks/bible_notes/bible_highlights store, so
// never rename a book here without migrating those rows.

export interface BibleBook {
  name: string;
  slug: string;
  /** eBible.org book code, used only by the build script. */
  code: string;
  chapters: number;
  /** Lower-case abbreviations accepted by the "go to" box. */
  abbr: string[];
}

export const BOOKS: readonly BibleBook[] = canon;

/** Genesis–Malachi are BOOKS[0..38]; Matthew–Revelation are BOOKS[39..65]. */
export const OLD_TESTAMENT_BOOKS = 39;

export function bookIndexByName(name: string | null | undefined): number {
  if (!name) return -1;
  const key = name.trim().toLowerCase();
  return BOOKS.findIndex((b) => b.name.toLowerCase() === key || b.slug === key);
}

/** Where a book's text lives for a version, e.g. /bibles/web/43-john.json */
export function bookFileUrl(versionId: string, bookIndex: number): string {
  return `/bibles/${versionId}/${String(bookIndex + 1).padStart(2, "0")}-${BOOKS[bookIndex].slug}.json`;
}

export interface ChapterRef {
  bookIndex: number;
  chapter: number;
}

/** The chapter after this one, crossing into the next book (Malachi 4 → Matthew 1). */
export function nextChapter({ bookIndex, chapter }: ChapterRef): ChapterRef | null {
  if (chapter < BOOKS[bookIndex].chapters) return { bookIndex, chapter: chapter + 1 };
  return bookIndex < BOOKS.length - 1 ? { bookIndex: bookIndex + 1, chapter: 1 } : null;
}

/** The chapter before this one, crossing into the previous book (Matthew 1 → Malachi 4). */
export function previousChapter({ bookIndex, chapter }: ChapterRef): ChapterRef | null {
  if (chapter > 1) return { bookIndex, chapter: chapter - 1 };
  return bookIndex > 0 ? { bookIndex: bookIndex - 1, chapter: BOOKS[bookIndex - 1].chapters } : null;
}

/**
 * Link to a passage in the reader. `book` is the readable name ("John"), so
 * links people share make sense; older links without `v` still work.
 */
export function readerHref({
  versionId,
  bookIndex,
  chapter,
  verse,
  verseEnd,
  base = "/dashboard/bible/read",
}: ChapterRef & { versionId?: string; verse?: number; verseEnd?: number; base?: string }): string {
  const params = new URLSearchParams();
  if (versionId) params.set("v", versionId);
  params.set("book", BOOKS[bookIndex].name);
  params.set("chapter", String(chapter));
  if (verse) params.set("verse", String(verse));
  if (verse && verseEnd && verseEnd > verse) params.set("to", String(verseEnd));
  return `${base}?${params}`;
}

/** Contents of one book's text file. Verse N is chapters[c-1][N-1]; "" = not in this version. */
export interface BookText {
  book: string;
  chapters: string[][];
}
