"use client";

import { NotebookPen, Pencil } from "lucide-react";
import type { ChapterNote } from "@/lib/bible/annotations";

/** "My notes" under a chapter: each note with its verse, an edit button, and a way to add a chapter note. */
export function ChapterNotes({
  notes,
  chapterLabel,
  onAdd,
  onEdit,
}: {
  notes: ChapterNote[];
  chapterLabel: string;
  onAdd: () => void;
  onEdit: (note: ChapterNote) => void;
}) {
  return (
    <section aria-labelledby="chapter-notes-title" className="card-elevated mt-10 rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="chapter-notes-title" className="text-xl font-semibold">
            My notes
          </h2>
          <p className="mt-1 text-sm text-ink/55">Private to you. Tap a verse, then Note, to add one to that verse.</p>
        </div>
        <button type="button" onClick={onAdd} className="btn-secondary btn-sm">
          <NotebookPen aria-hidden className="h-4 w-4" />
          Note on {chapterLabel}
        </button>
      </div>

      {notes.length ? (
        <ul className="divide-y divide-line">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="eyebrow mb-1">{n.verse ? `Verse ${n.verse}` : "Whole chapter"}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-ink/85">{n.note}</p>
              </div>
              <button
                type="button"
                onClick={() => onEdit(n)}
                className="btn-ghost btn-sm h-8 w-8 shrink-0 p-0"
                aria-label={`Edit note on ${n.verse ? `verse ${n.verse}` : "the whole chapter"}`}
              >
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/55">No notes on this chapter yet.</p>
      )}
    </section>
  );
}
