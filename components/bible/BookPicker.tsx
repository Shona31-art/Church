"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BOOKS, readerHref } from "@/lib/bible/books";
import { verseCount } from "@/lib/bible/verse-counts";

/**
 * The book list on the Bible home page. Tapping a book asks which chapter,
 * then which verse (or "Start of chapter"), instead of always opening
 * chapter 1. Books with one chapter (e.g. Jude) skip straight to verses.
 */
export function BookPicker({ title, from, to }: { title: string; from: number; to: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [bookIndex, setBookIndex] = useState<number | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);

  function open(index: number) {
    setBookIndex(index);
    setChapter(BOOKS[index].chapters === 1 ? 1 : null);
    dialogRef.current?.showModal();
  }

  const book = bookIndex !== null ? BOOKS[bookIndex] : null;
  const cell = "grid aspect-square place-items-center rounded-xl border border-line bg-surface text-sm font-semibold tabular-nums hover:border-gold hover:bg-gold/10 focus-visible:border-gold";

  return (
    <>
      <h3 className="eyebrow mb-2 mt-5">{title}</h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {BOOKS.slice(from, to).map((b, i) => (
          <li key={b.slug}>
            <button
              type="button"
              onClick={() => open(from + i)}
              aria-haspopup="dialog"
              className="block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm font-medium hover:border-line-strong hover:bg-surface-raised"
            >
              {b.name}
              <span className="block text-xs font-normal text-ink/50">
                {b.chapters} {b.chapters === 1 ? "chapter" : "chapters"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-labelledby={`pick-${from}-title`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 text-ink shadow-pop backdrop:bg-ink/45 motion-safe:animate-modal-in"
        onClose={() => setBookIndex(null)}
      >
        {book && bookIndex !== null && (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-center gap-2 border-b border-line p-4">
              {chapter !== null && book.chapters > 1 ? (
                <button type="button" onClick={() => setChapter(null)} className="btn-ghost btn-icon -ml-1 h-9 w-9" aria-label="Back to chapters">
                  <ChevronLeft aria-hidden className="h-5 w-5" />
                </button>
              ) : null}
              <div className="min-w-0 flex-1">
                <h2 id={`pick-${from}-title`} className="truncate text-lg font-semibold">
                  {book.name}
                  {chapter !== null ? ` ${chapter}` : ""}
                </h2>
                <p className="text-xs text-ink/60">{chapter === null ? "Choose a chapter" : "Choose a verse"}</p>
              </div>
              <button type="button" onClick={() => dialogRef.current?.close()} className="btn-secondary btn-sm">
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {chapter === null ? (
                <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
                    <li key={c}>
                      <button type="button" onClick={() => setChapter(c)} className={`${cell} w-full`} aria-label={`Chapter ${c}`}>
                        {c}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <Link href={readerHref({ bookIndex, chapter })} className="btn-primary mb-3 w-full justify-center">
                    Start of chapter {chapter}
                  </Link>
                  <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                    {Array.from({ length: verseCount(bookIndex, chapter) }, (_, i) => i + 1).map((v) => (
                      <li key={v}>
                        <Link href={readerHref({ bookIndex, chapter, verse: v })} className={cell} aria-label={`Verse ${v}`}>
                          {v}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
