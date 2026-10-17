"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import {
  HIGHLIGHT_COLORS,
  chapterSchema,
  noteSchema,
  versesSchema,
  type ChapterAnnotations,
  type HighlightColor,
} from "@/lib/bible/annotations";

// Personal annotations for the Bible reader: highlights, bookmarks, notes.
// Every action re-checks the session and the church's plan, validates input
// with Zod, and writes as the signed-in member — Row Level Security
// (owner only, bible_reader_v2.sql) is the real guard, so these can never
// touch anyone else's rows. Errors come back as friendly messages; the real
// error is logged server-side.

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; signedOut?: boolean };

const SIGNED_OUT: Result<never> = { ok: false, error: "Your session has expired. Sign in again to save highlights and notes.", signedOut: true };
const NOT_ON_PLAN: Result<never> = { ok: false, error: "The Bible isn't available on your church's plan." };
const BAD_INPUT: Result<never> = { ok: false, error: "That didn't look right. Refresh the page and try again." };

type AppUser = NonNullable<Awaited<ReturnType<typeof getCurrentAppUser>>>;

async function signedInMember(): Promise<{ ok: true; me: AppUser } | { ok: false; error: Result<never> }> {
  const me = await getCurrentAppUser();
  if (!me) return { ok: false, error: SIGNED_OUT };
  if (!(await checkModuleAccess("bible")).allowed) return { ok: false, error: NOT_ON_PLAN };
  return { ok: true, me };
}

function failed(action: string, error: { message: string }): Result<never> {
  console.error(`[bible] ${action} failed:`, error.message);
  return { ok: false, error: "Couldn't save that. Check your connection and try again." };
}

/**
 * Input: { book: "John", chapter: 3 }
 * Returns this member's highlights (verse → colour), bookmarked verses and notes for that chapter.
 */
export async function getChapterAnnotations(input: { book: string; chapter: number }): Promise<Result<ChapterAnnotations>> {
  const auth = await signedInMember();
  if (!auth.ok) return auth.error;
  const parsed = chapterSchema.safeParse(input);
  if (!parsed.success) return BAD_INPUT;
  const { book, chapter } = parsed.data;

  const supabase = createClient();
  const [highlights, bookmarks, notes] = await Promise.all([
    supabase.from("bible_highlights").select("verse, color").eq("user_id", auth.me.id).eq("book", book).eq("chapter", chapter),
    supabase.from("bible_bookmarks").select("verse").eq("user_id", auth.me.id).eq("book", book).eq("chapter", chapter),
    supabase
      .from("bible_notes")
      .select("id, verse, note, updated_at")
      .eq("user_id", auth.me.id)
      .eq("book", book)
      .eq("chapter", chapter)
      .order("verse", { ascending: true, nullsFirst: true })
      .order("created_at"),
  ]);
  const error = highlights.error ?? bookmarks.error ?? notes.error;
  if (error) {
    console.error("[bible] load annotations failed:", error.message);
    return { ok: false, error: "Couldn't load your highlights and notes for this chapter." };
  }

  return {
    ok: true,
    data: {
      highlights: Object.fromEntries((highlights.data ?? []).map((h) => [h.verse, h.color as HighlightColor])),
      bookmarks: (bookmarks.data ?? []).map((b) => b.verse),
      notes: (notes.data ?? []).map((n) => ({ id: n.id, verse: n.verse, note: n.note, updatedAt: n.updated_at })),
    },
  };
}

/**
 * Input: { book, chapter, verses: [16, 17], color: "yellow" | null }
 * Sets the colour on each verse (replacing any other colour), or removes the highlight when color is null.
 */
export async function setHighlight(input: { book: string; chapter: number; verses: number[]; color: HighlightColor | null }): Promise<Result> {
  const auth = await signedInMember();
  if (!auth.ok) return auth.error;
  const parsed = z
    .object({ verses: versesSchema, color: z.enum(HIGHLIGHT_COLORS).nullable() })
    .and(chapterSchema)
    .safeParse(input);
  if (!parsed.success) return BAD_INPUT;
  const { book, chapter, verses, color } = parsed.data;
  const supabase = createClient();

  if (color === null) {
    const { error } = await supabase.from("bible_highlights").delete().eq("user_id", auth.me.id).eq("book", book).eq("chapter", chapter).in("verse", verses);
    return error ? failed("remove highlight", error) : { ok: true, data: undefined };
  }

  const { error } = await supabase
    .from("bible_highlights")
    .upsert(
      [...new Set(verses)].map((verse) => ({ user_id: auth.me.id, book, chapter, verse, color })),
      { onConflict: "user_id,book,chapter,verse" },
    );
  return error ? failed("highlight", error) : { ok: true, data: undefined };
}

/**
 * Input: { book, chapter, verses: [16], bookmarked: true | false }
 * Adds bookmarks to (or removes them from) the given verses.
 */
export async function setBookmarks(input: { book: string; chapter: number; verses: number[]; bookmarked: boolean }): Promise<Result> {
  const auth = await signedInMember();
  if (!auth.ok) return auth.error;
  const parsed = z.object({ verses: versesSchema, bookmarked: z.boolean() }).and(chapterSchema).safeParse(input);
  if (!parsed.success) return BAD_INPUT;
  const { book, chapter, verses, bookmarked } = parsed.data;
  const supabase = createClient();

  const { error } = bookmarked
    ? await supabase
        .from("bible_bookmarks")
        .upsert(
          [...new Set(verses)].map((verse) => ({ user_id: auth.me.id, book, chapter, verse })),
          { onConflict: "user_id,book,chapter,verse", ignoreDuplicates: true },
        )
    : await supabase.from("bible_bookmarks").delete().eq("user_id", auth.me.id).eq("book", book).eq("chapter", chapter).in("verse", verses);
  return error ? failed("bookmark", error) : { ok: true, data: undefined };
}

/**
 * Input: { id?: uuid, book, chapter, verse: number | null, note: string (1–2000) }
 * Creates a note (no id) or edits one of your own notes (with id). Returns the note's id.
 */
export async function saveNote(input: { id?: string; book: string; chapter: number; verse: number | null; note: string }): Promise<Result<{ id: string }>> {
  const auth = await signedInMember();
  if (!auth.ok) return auth.error;
  const parsed = z
    .object({ id: z.string().uuid().optional(), verse: z.number().int().min(1).max(200).nullable(), note: noteSchema })
    .and(chapterSchema)
    .safeParse(input);
  if (!parsed.success) {
    const noteIssue = parsed.error.issues.find((i) => i.path[0] === "note");
    return noteIssue ? { ok: false, error: noteIssue.message } : BAD_INPUT;
  }
  const { id, book, chapter, verse, note } = parsed.data;
  const supabase = createClient();

  if (id) {
    const { data, error } = await supabase.from("bible_notes").update({ note }).eq("id", id).eq("user_id", auth.me.id).select("id").maybeSingle();
    if (error) return failed("edit note", error);
    if (!data) return { ok: false, error: "That note no longer exists. It may have been deleted on another device." };
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase.from("bible_notes").insert({ user_id: auth.me.id, book, chapter, verse, note }).select("id").single();
  return error ? failed("add note", error) : { ok: true, data: { id: data.id } };
}

/** Input: note id. Deletes one of your own notes (the reader asks for confirmation first). */
export async function deleteNote(id: string): Promise<Result> {
  const auth = await signedInMember();
  if (!auth.ok) return auth.error;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return BAD_INPUT;

  const { error } = await createClient().from("bible_notes").delete().eq("id", parsed.data).eq("user_id", auth.me.id);
  return error ? failed("delete note", error) : { ok: true, data: undefined };
}
