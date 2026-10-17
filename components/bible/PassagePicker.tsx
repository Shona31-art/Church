"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import { BOOKS, OLD_TESTAMENT_BOOKS } from "@/lib/bible/books";
import { booksMatching, parseReference, type Reference } from "@/lib/bible/reference";
import { loadBook } from "@/lib/bible/load-book";

type Step = { kind: "book" } | { kind: "chapter"; bookIndex: number } | { kind: "verse"; bookIndex: number; chapter: number };

/**
 * Bible-app style "go to" popup: pick a book, then a chapter, then (optionally)
 * a verse — or type a reference ("jn 3:16") and press Enter. Typing a few
 * letters also filters the book list.
 *
 * Native <dialog>, like RouteModal: focus stays inside, Escape closes it, and
 * focus returns to the button that opened it.
 */
export function PassagePicker({
  open,
  onClose,
  onSelect,
  versionId,
  current,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: Reference) => void;
  versionId: string;
  current: { bookIndex: number; chapter: number };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>({ kind: "book" });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setStep({ kind: "book" });
      setQuery("");
      setError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Moving between steps: put focus on the new step's heading so keyboard and
  // screen-reader users know where they are.
  useEffect(() => {
    if (step.kind !== "book") headingRef.current?.focus();
  }, [step]);

  function choose(ref: Reference) {
    onSelect(ref);
    onClose();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ref = parseReference(query);
    // A bare book name ("john") opens its chapter list rather than jumping to chapter 1.
    const onlyBook = booksMatching(query);
    if (ref && /\d/.test(query)) return choose(ref);
    if (onlyBook.length === 1) return setStep({ kind: "chapter", bookIndex: onlyBook[0] });
    if (ref) return setStep({ kind: "chapter", bookIndex: ref.bookIndex });
    if (onlyBook.length > 1 && !/\d/.test(query)) return setError("Several books match. Pick one below, or type more letters.");
    setError("We couldn't find that. Try something like John 3:16 or Psalm 23.");
  }

  const filtered = query.trim() ? booksMatching(query) : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Go to a passage"
      className="m-0 h-full max-h-full w-full max-w-full rounded-none bg-parchment p-0 text-ink shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] motion-safe:animate-modal-in md:m-auto md:h-auto md:max-h-[85vh] md:w-[calc(100%-2rem)] md:max-w-2xl md:rounded-2xl md:border md:border-line"
    >
      <div className="flex h-full flex-col md:max-h-[85vh]">
        <div className="border-b border-line bg-parchment px-4 pb-3 pt-3 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            {step.kind === "book" ? (
              <h2 className="text-lg font-semibold">Go to</h2>
            ) : (
              <button
                type="button"
                className="btn-ghost btn-sm -ml-2"
                onClick={() => setStep(step.kind === "verse" ? { kind: "chapter", bookIndex: step.bookIndex } : { kind: "book" })}
              >
                <ChevronLeft aria-hidden className="h-4 w-4" />
                {step.kind === "verse" ? "Chapters" : "Books"}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-secondary btn-sm h-9 w-9 rounded-full p-0" aria-label="Close">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>

          {step.kind === "book" && (
            <form onSubmit={submit} role="search">
              <label htmlFor="passage-query" className="sr-only">
                Book or reference
              </label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                <input
                  id="passage-query"
                  className="input pl-9"
                  placeholder="Type a book or reference, e.g. John 3:16"
                  autoComplete="off"
                  enterKeyHint="go"
                  value={query}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "passage-query-error" : undefined}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setError(null);
                  }}
                />
              </div>
              {error && (
                <p id="passage-query-error" role="alert" className="mt-2 text-sm text-danger">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {step.kind === "book" &&
            (filtered ? (
              filtered.length ? (
                <BookGrid indexes={filtered} current={current.bookIndex} onPick={(i) => setStep({ kind: "chapter", bookIndex: i })} />
              ) : (
                <p className="py-6 text-center text-sm text-ink/55">No book starts with “{query.trim()}”.</p>
              )
            ) : (
              <>
                <h3 className="eyebrow mb-2">Old Testament</h3>
                <BookGrid
                  indexes={BOOKS.slice(0, OLD_TESTAMENT_BOOKS).map((_, i) => i)}
                  current={current.bookIndex}
                  onPick={(i) => setStep({ kind: "chapter", bookIndex: i })}
                />
                <h3 className="eyebrow mb-2 mt-6">New Testament</h3>
                <BookGrid
                  indexes={BOOKS.slice(OLD_TESTAMENT_BOOKS).map((_, i) => i + OLD_TESTAMENT_BOOKS)}
                  current={current.bookIndex}
                  onPick={(i) => setStep({ kind: "chapter", bookIndex: i })}
                />
              </>
            ))}

          {step.kind === "chapter" && (
            <>
              <h3 ref={headingRef} tabIndex={-1} className="mb-1 text-xl font-semibold outline-none">
                {BOOKS[step.bookIndex].name}
              </h3>
              <p className="mb-4 text-sm text-ink/55">Choose a chapter</p>
              <NumberGrid
                count={BOOKS[step.bookIndex].chapters}
                current={step.bookIndex === current.bookIndex ? current.chapter : undefined}
                label={(n) => `Chapter ${n}`}
                onPick={(n) =>
                  // One-chapter books (Jude, Philemon…) go straight to their verses.
                  setStep({ kind: "verse", bookIndex: step.bookIndex, chapter: n })
                }
              />
            </>
          )}

          {step.kind === "verse" && (
            <VerseStep
              headingRef={headingRef}
              versionId={versionId}
              bookIndex={step.bookIndex}
              chapter={step.chapter}
              onPick={choose}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}

function BookGrid({ indexes, current, onPick }: { indexes: number[]; current: number; onPick: (bookIndex: number) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {indexes.map((i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-current={i === current ? "true" : undefined}
            className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium hover:border-line-strong hover:bg-surface-raised ${
              i === current ? "border-ember/40 bg-surface-raised" : "border-line bg-surface"
            }`}
          >
            {BOOKS[i].name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function NumberGrid({
  count,
  current,
  label,
  onPick,
}: {
  count: number;
  current?: number;
  label: (n: number) => string;
  onPick: (n: number) => void;
}) {
  return (
    <ul className="grid grid-cols-5 gap-2 sm:grid-cols-8">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <li key={n}>
          <button
            type="button"
            onClick={() => onPick(n)}
            aria-label={label(n)}
            aria-current={n === current ? "true" : undefined}
            className={`tabular aspect-square w-full rounded-xl border text-sm font-semibold hover:border-line-strong hover:bg-surface-raised ${
              n === current ? "border-ember bg-ember text-on-ember hover:bg-ember/90" : "border-line bg-surface"
            }`}
          >
            {n}
          </button>
        </li>
      ))}
    </ul>
  );
}

function VerseStep({
  headingRef,
  versionId,
  bookIndex,
  chapter,
  onPick,
}: {
  headingRef: React.RefObject<HTMLHeadingElement>;
  versionId: string;
  bookIndex: number;
  chapter: number;
  onPick: (ref: Reference) => void;
}) {
  const [verseCount, setVerseCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadBook(versionId, bookIndex)
      .then((book) => !cancelled && setVerseCount(book.chapters[chapter - 1]?.length ?? 0))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [versionId, bookIndex, chapter]);

  return (
    <>
      <h3 ref={headingRef} tabIndex={-1} className="mb-1 text-xl font-semibold outline-none">
        {BOOKS[bookIndex].name} {chapter}
      </h3>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink/55">Choose a verse</p>
        <button type="button" className="btn-secondary btn-sm" onClick={() => onPick({ bookIndex, chapter })}>
          Open whole chapter
        </button>
      </div>
      {verseCount !== null ? (
        <NumberGrid count={verseCount} label={(n) => `Verse ${n}`} onPick={(n) => onPick({ bookIndex, chapter, verse: n })} />
      ) : failed ? (
        <p className="text-sm text-ink/55">Couldn&apos;t load the verse list. You can still open the whole chapter.</p>
      ) : (
        <p className="text-sm text-ink/55" role="status">
          Loading verses…
        </p>
      )}
    </>
  );
}
