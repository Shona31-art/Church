"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@/components/ui/Toaster";
import { deleteNote, getChapterAnnotations, saveNote, setBookmarks, setHighlight } from "@/app/dashboard/bible/read/actions";
import type { ChapterAnnotations, HighlightColor } from "@/lib/bible/annotations";

type State =
  | { status: "loading" }
  | { status: "ready"; data: ChapterAnnotations }
  | { status: "error"; message: string; signedOut?: boolean };

type ActionResult = { ok: true } | { ok: false; error: string; signedOut?: boolean };

const OFFLINE_MESSAGE = "Highlights and notes need an internet connection. Reading still works offline.";

/**
 * The signed-in member's highlights, bookmarks and notes for one chapter.
 *
 * Changes show immediately (optimistic) and are undone with a message if the
 * save fails, so nothing silently disappears. Results that arrive after the
 * reader has moved to another chapter are ignored.
 */
export function useChapterAnnotations(book: string, chapter: number, enabled: boolean) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const currentKey = useRef(`${book}:${chapter}`);
  currentKey.current = `${book}:${chapter}`;
  // Latest state, readable synchronously (setState updaters run later), for undoing a failed save.
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (!enabled) return;
    const key = `${book}:${chapter}`;
    setState({ status: "loading" });
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState({ status: "error", message: "You're offline, so your highlights and notes aren't shown." });
      return;
    }
    getChapterAnnotations({ book, chapter })
      .then((res) => {
        if (currentKey.current !== key) return;
        setState(res.ok ? { status: "ready", data: res.data } : { status: "error", message: res.error, signedOut: res.signedOut });
      })
      .catch(() => currentKey.current === key && setState({ status: "error", message: "Couldn't load your highlights and notes." }));
  }, [book, chapter, enabled, attempt]);

  /** Apply `change` now; run `save`; put the old data back if it fails. */
  const mutate = useCallback(
    async (change: (data: ChapterAnnotations) => ChapterAnnotations, save: () => Promise<ActionResult>): Promise<boolean> => {
      if (!navigator.onLine) {
        showToast(OFFLINE_MESSAGE, "error");
        return false;
      }
      const key = currentKey.current;
      const current = latest.current;
      if (current.status !== "ready") return false;
      const before = current.data;
      const after = change(before);
      latest.current = { status: "ready", data: after }; // so a second quick tap builds on this one
      setState(latest.current);
      let res: ActionResult;
      try {
        res = await save();
      } catch {
        res = { ok: false, error: "Couldn't save that. Check your connection and try again." };
      }
      if (!res.ok) {
        if (currentKey.current === key) setState({ status: "ready", data: before });
        showToast(res.error, "error");
        return false;
      }
      return true;
    },
    [],
  );

  const highlight = useCallback(
    (verses: number[], color: HighlightColor | null) =>
      mutate(
        (d) => {
          const highlights = { ...d.highlights };
          for (const v of verses) {
            if (color) highlights[v] = color;
            else delete highlights[v];
          }
          return { ...d, highlights };
        },
        () => setHighlight({ book, chapter, verses, color }),
      ),
    [mutate, book, chapter],
  );

  const bookmark = useCallback(
    (verses: number[], bookmarked: boolean) =>
      mutate(
        (d) => ({
          ...d,
          bookmarks: bookmarked ? [...new Set([...d.bookmarks, ...verses])] : d.bookmarks.filter((v) => !verses.includes(v)),
        }),
        () => setBookmarks({ book, chapter, verses, bookmarked }),
      ),
    [mutate, book, chapter],
  );

  /** Not optimistic: the note dialog stays open (keeping the text) until the save succeeds. */
  const writeNote = useCallback(
    async (input: { id?: string; verse: number | null; note: string }): Promise<string | null> => {
      if (!navigator.onLine) return OFFLINE_MESSAGE;
      const key = currentKey.current;
      let res: Awaited<ReturnType<typeof saveNote>>;
      try {
        res = await saveNote({ ...input, book, chapter });
      } catch {
        return "Couldn't save your note. Check your connection and try again.";
      }
      if (!res.ok) return res.error;
      if (currentKey.current === key) {
        const saved = { id: res.data.id, verse: input.verse, note: input.note.trim(), updatedAt: new Date().toISOString() };
        setState((s) =>
          s.status !== "ready"
            ? s
            : {
                status: "ready",
                data: {
                  ...s.data,
                  notes: input.id ? s.data.notes.map((n) => (n.id === input.id ? saved : n)) : [...s.data.notes, saved],
                },
              },
        );
      }
      showToast(input.id ? "Note updated." : "Note saved.");
      return null;
    },
    [book, chapter],
  );

  const removeNote = useCallback(
    async (id: string) => {
      const ok = await mutate((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }), () => deleteNote(id));
      if (ok) showToast("Note deleted.");
      return ok;
    },
    [mutate],
  );

  return { state, retry: () => setAttempt((n) => n + 1), highlight, bookmark, writeNote, removeNote };
}
