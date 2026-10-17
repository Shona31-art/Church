// Fetches chapter text at read-time from bible-api.com, which serves
// public-domain translations (default: WEB — World English Bible) for
// free with no API key. Verse text is never stored in our own database —
// only references (book/chapter/verse) are, in bible_bookmarks/bible_notes.
// This sidesteps Bible-translation copyright/licensing entirely: we're
// never the one distributing the text, just linking to it live.
//
// If you later want a licensed modern translation (NIV, ESV, etc.), swap
// this for API.Bible or YouVersion's API — both require a paid/licensed
// agreement, which is a real procurement step, not a code change.

import { BOOKS } from "./books";

export interface BibleVerse {
  verse: number;
  text: string;
}

export async function fetchChapter(
  book: string,
  chapter: number,
  translation: string = "web"
): Promise<BibleVerse[]> {
  const ref = encodeURIComponent(`${book} ${chapter}`);
  try {
    const res = await fetch(`https://bible-api.com/${ref}?translation=${translation}`, {
      next: { revalidate: 60 * 60 * 24 }, // cache a day — chapter text never changes
      signal: AbortSignal.timeout(8000), // third-party API: never hang a page on it
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.verses) return [];
    return data.verses.map((v: any) => ({ verse: v.verse, text: v.text.trim() }));
  } catch (error) {
    console.error("[bible] chapter fetch failed:", error);
    return [];
  }
}

/** Book names in canonical order (from canon.json, shared with the reader v2 files). */
export const BIBLE_BOOKS = BOOKS.map((b) => b.name);

export async function fetchVerse(reference: string, translation: string = "web"): Promise<string | null> {
  try {
    const res = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`, {
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text ? String(data.text).replace(/\s+/g, " ").trim() : null;
  } catch (error) {
    console.error("[bible] verse fetch failed:", error);
    return null;
  }
}

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
