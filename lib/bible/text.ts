import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { BOOKS, type BookText } from "./books";
import { parseReference, type Reference } from "./reference";
import { DEFAULT_VERSION_ID } from "./versions";

// Server-side access to the Bible text in public/bibles/ — for the daily verse
// on the dashboard and the passage given to the AI study tool. (The reader and
// search load the same files in the browser instead.)
//
// On Vercel, files in public/ are served from the CDN and aren't part of a
// server function's files by default; next.config.js lists the WEB files in
// outputFileTracingIncludes for the routes that call this. Add a route there
// if you call this from somewhere new.

const books = new Map<string, Promise<BookText>>();

function readBook(versionId: string, bookIndex: number): Promise<BookText> {
  const file = path.join(process.cwd(), "public", "bibles", versionId, `${String(bookIndex + 1).padStart(2, "0")}-${BOOKS[bookIndex].slug}.json`);
  let book = books.get(file);
  if (!book) {
    book = fs.readFile(file, "utf8").then((json) => JSON.parse(json) as BookText);
    book.catch(() => books.delete(file));
    books.set(file, book);
  }
  return book;
}

/** The words of a passage (one verse, a range, or a whole chapter), brackets removed. null if it doesn't exist. */
export async function passageText(ref: Reference, versionId: string = DEFAULT_VERSION_ID): Promise<string | null> {
  try {
    const verses = (await readBook(versionId, ref.bookIndex)).chapters[ref.chapter - 1];
    if (!verses) return null;
    const from = ref.verse ?? 1;
    const to = ref.verse ? ref.verseEnd ?? ref.verse : verses.length;
    const text = verses
      .slice(from - 1, to)
      .filter(Boolean)
      .join(" ")
      .replace(/[[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  } catch (error) {
    console.error("[bible] couldn't read passage text:", error);
    return null;
  }
}

/** "Proverbs 3:5-6" → its text in the default version (WEB), or null if not a reference we recognise. */
export async function fetchVerse(reference: string, versionId: string = DEFAULT_VERSION_ID): Promise<string | null> {
  const ref = parseReference(reference);
  return ref ? passageText(ref, versionId) : null;
}
