import { z } from "zod";
import { BOOKS } from "./books";

// Highlights, bookmarks and notes: shared by the server actions
// (app/dashboard/bible/read/actions.ts) and the reader UI, so both validate
// the same way. The database enforces the same limits (bible_reader_v2.sql).

/** Must match the check constraint on bible_highlights.color. */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const HIGHLIGHT_LABELS: Record<HighlightColor, string> = {
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  pink: "Pink",
  purple: "Purple",
};

export const MAX_NOTE_LENGTH = 2000;

/** A chapter that exists: a real book name and a chapter within it. */
export const chapterSchema = z
  .object({ book: z.string(), chapter: z.number().int() })
  .refine(({ book, chapter }) => {
    const b = BOOKS.find((x) => x.name === book);
    return Boolean(b) && chapter >= 1 && chapter <= b!.chapters;
  }, "That passage doesn't exist.");

/** 1–200 distinct verse numbers (no chapter has more than 176 verses). */
export const versesSchema = z.array(z.number().int().min(1).max(200)).min(1).max(200);

export const noteSchema = z
  .string()
  .trim()
  .min(1, "Write something first.")
  .max(MAX_NOTE_LENGTH, `Notes can be up to ${MAX_NOTE_LENGTH.toLocaleString("en-ZA")} characters.`);

export interface ChapterNote {
  id: string;
  verse: number | null;
  note: string;
  updatedAt: string;
}

/** Everything personal about one chapter, for the signed-in member only. */
export interface ChapterAnnotations {
  highlights: Record<number, HighlightColor>;
  bookmarks: number[];
  notes: ChapterNote[];
}
