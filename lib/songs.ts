import { z } from "zod";

// Song rules shared by the forms, the server actions and the bulk import.
// The database (supabase/songs.sql) enforces the same limits and who may edit.

export const songSchema = z.object({
  title: z.string().trim().min(1, "Give the song a title.").max(200, "Keep the title under 200 characters."),
  author: z.string().trim().max(200, "Keep the writer under 200 characters.").optional(),
  songKey: z.string().trim().max(12, "Keep the key short, e.g. G or Bb.").optional(),
  lyrics: z
    .string()
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().max(20_000, "Those lyrics are very long (20,000 characters max).")),
});
export type SongInput = z.infer<typeof songSchema>;

/** Who can add, edit and delete songs (the database checks the same). */
export function canManageSongs(me: { role: string; department_id?: string | null }, worshipDepartmentId: string | null): boolean {
  if (["pastor", "church_admin"].includes(me.role)) return true;
  return Boolean(worshipDepartmentId && me.department_id === worshipDepartmentId);
}

export const MAX_IMPORT_SONGS = 500;

/**
 * Bulk import: songs separated by a line of three or more dashes (---).
 * In each song the first non-empty line is the title; everything after it is
 * the lyrics. A line "Key: G" or "By: Someone" straight after the title is
 * picked up as the key / writer.
 */
export function parseSongList(text: string): SongInput[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*-{3,}\s*\n/)
    .map((block) => block.replace(/^\s*\n/, "").replace(/\s+$/, ""))
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const title = lines.shift()!.trim();
      let author: string | undefined;
      let songKey: string | undefined;
      while (lines.length) {
        const meta = lines[0].match(/^\s*(key|by|writer|author)\s*:\s*(.+?)\s*$/i);
        if (!meta) break;
        if (meta[1].toLowerCase() === "key") songKey = meta[2];
        else author = meta[2];
        lines.shift();
      }
      return { title, author, songKey, lyrics: lines.join("\n").trim() };
    });
}

/** First letter for the A–Z index ("#" for numbers and symbols). */
export function songLetter(title: string): string {
  const c = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}
