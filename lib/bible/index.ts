// Small shared Bible helpers. The text itself is self-hosted public-domain
// files in public/bibles/ (see docs/adr/0001-bible-text-hosting-and-offline.md):
// lib/bible/text.ts reads them on the server, lib/bible/load-book.ts in the
// browser. Verse text is never stored in the database — only references
// (book/chapter/verse), in bible_bookmarks/bible_notes/bible_highlights.

import { BOOKS } from "./books";

/** Book names in canonical order (from canon.json). */
export const BIBLE_BOOKS = BOOKS.map((b) => b.name);

export const DAILY_VERSE_REFS = [
  "Jeremiah 29:11", "Psalm 23:1", "Philippians 4:13", "Proverbs 3:5-6",
  "Isaiah 40:31", "Romans 8:28", "Joshua 1:9", "Psalm 46:1",
  "2 Corinthians 5:17", "Matthew 6:33", "Psalm 118:24", "John 3:16",
  "1 Corinthians 13:4-7", "Galatians 5:22-23",
];

/** Same verse for everyone on a given day, rotating through DAILY_VERSE_REFS. */
export function verseRefForDate(date: Date): string {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return DAILY_VERSE_REFS[dayNumber % DAILY_VERSE_REFS.length];
}
