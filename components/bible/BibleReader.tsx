"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { BOOKS, bookIndexByName, nextChapter, previousChapter, readerHref, type BookText, type ChapterRef } from "@/lib/bible/books";
import { formatReference, type Reference } from "@/lib/bible/reference";
import { VERSIONS, versionById } from "@/lib/bible/versions";
import { BookLoadError, loadBook } from "@/lib/bible/load-book";
import { readLastPlace, writeLastPlace } from "@/lib/bible/reader-prefs";
import { PassagePicker } from "./PassagePicker";
import { VerseText } from "./VerseText";

const JOHN = BOOKS.findIndex((b) => b.name === "John");

type Load = { status: "loading" } | { status: "ready"; book: BookText } | { status: "error"; offline: boolean };

/**
 * The Bible reader. The passage lives in the URL (?v=web&book=John&chapter=3&verse=16),
 * so links, refresh and the browser Back button all work. Moving between
 * chapters updates the URL with history.pushState — no server round trip —
 * and the text comes from the static files in public/bibles/.
 */
export function BibleReader() {
  const params = useSearchParams();
  const version = versionById(params.get("v"));
  const requestedBook = bookIndexByName(params.get("book"));
  const bookIndex = requestedBook >= 0 ? requestedBook : JOHN;
  const chapter = clamp(Number(params.get("chapter")) || 1, 1, BOOKS[bookIndex].chapters);
  const verse = Number(params.get("verse")) || undefined;
  const verseEnd = Number(params.get("to")) || undefined;

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const go = useCallback(
    (to: Partial<Reference> & { versionId?: string }, { replace = false } = {}) => {
      const href = readerHref({
        versionId: to.versionId ?? version.id,
        bookIndex: to.bookIndex ?? bookIndex,
        chapter: to.chapter ?? chapter,
        verse: to.verse,
        verseEnd: to.verseEnd,
      });
      window.history[replace ? "replaceState" : "pushState"](null, "", href);
      if (!to.verse) window.scrollTo({ top: 0 });
    },
    [version.id, bookIndex, chapter],
  );

  // Opening the reader with no passage in the URL (e.g. from the menu): carry
  // on where this device last left off.
  useEffect(() => {
    if (params.get("book")) return;
    const last = readLastPlace();
    if (last && BOOKS[last.bookIndex]) go({ versionId: versionById(last.versionId).id, bookIndex: last.bookIndex, chapter: last.chapter }, { replace: true });
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeLastPlace({ versionId: version.id, bookIndex, chapter });
  }, [version.id, bookIndex, chapter]);

  useEffect(() => {
    let cancelled = false;
    setLoad((current) => (current.status === "ready" && current.book.book === BOOKS[bookIndex].name ? current : { status: "loading" }));
    loadBook(version.id, bookIndex)
      .then((book) => !cancelled && setLoad({ status: "ready", book }))
      .catch((error) => !cancelled && setLoad({ status: "error", offline: error instanceof BookLoadError && error.offline }));
    return () => {
      cancelled = true;
    };
  }, [version.id, bookIndex, attempt]);

  // Jump to the requested verse once its chapter is on screen.
  const ready = load.status === "ready";
  useEffect(() => {
    if (!ready || !verse) return;
    document.getElementById(`v${verse}`)?.scrollIntoView({ block: "center" });
  }, [ready, verse, chapter, bookIndex]);

  const previous = previousChapter({ bookIndex, chapter });
  const next = nextChapter({ bookIndex, chapter });

  // ← and → move between chapters, unless someone is typing or a popup is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || pickerOpen) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
      if (e.key === "ArrowLeft" && previous) go(previous);
      if (e.key === "ArrowRight" && next) go(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previous, next, go, pickerOpen]);

  const title = formatReference({ bookIndex, chapter });
  const verses = load.status === "ready" ? load.book.chapters[chapter - 1] ?? [] : [];

  return (
    <div className="mx-auto max-w-2xl">
      {/* Toolbar: sticks under the phone header (57px) or to the top on desktop. */}
      <div className="card-elevated sticky top-[65px] z-10 mb-8 flex items-center gap-1 rounded-2xl bg-surface/95 p-1.5 backdrop-blur md:top-4">
        <ChapterButton target={previous} direction="previous" onGo={go} />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-label={`${title}. Choose another book, chapter or verse`}
          className="btn-ghost min-w-0 flex-1 px-2 text-base font-semibold text-ink"
        >
          <span className="truncate">{title}</span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/50" />
        </button>
        {/* Shows just "WEB" so it fits a phone toolbar; the real (invisible)
            select on top keeps native keyboard/screen-reader behaviour and
            lists full names. */}
        <div className="relative shrink-0 rounded-xl border border-line hover:border-line-strong focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold">
          <span aria-hidden className="flex h-10 items-center gap-1 px-2.5 text-sm font-semibold">
            {version.abbreviation}
            <ChevronDown className="h-3.5 w-3.5 text-ink/50" />
          </span>
          <label htmlFor="bible-version" className="sr-only">
            Version
          </label>
          <select
            id="bible-version"
            value={version.id}
            onChange={(e) => go({ versionId: e.target.value, verse }, { replace: true })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline-none"
          >
            {VERSIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.abbreviation} · {v.name}
              </option>
            ))}
          </select>
        </div>
        <ChapterButton target={next} direction="next" onGo={go} />
      </div>

      <article aria-labelledby="chapter-title" aria-busy={load.status === "loading"}>
        <h1 id="chapter-title" className="text-[28px] font-semibold leading-tight sm:text-[32px]">
          {title}
        </h1>
        <div className="rule-gold mb-6 mt-3" />

        {load.status === "loading" && <ChapterSkeleton />}

        {load.status === "error" && (
          <Alert
            tone={load.offline ? "warning" : "error"}
            title={load.offline ? "You're offline" : "Couldn't load this chapter"}
            action={
              <button type="button" className="btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            }
          >
            {load.offline
              ? `This chapter of the ${version.abbreviation} isn't saved on this device. Connect to the internet and try again.`
              : "Check your connection and try again."}
          </Alert>
        )}

        {load.status === "ready" && (
          <div className="space-y-2.5 text-[17px] leading-[1.8] text-ink/90">
            {verses.map((text, i) => {
              const n = i + 1;
              const focused = verse !== undefined && n >= verse && n <= (verseEnd ?? verse);
              return (
                <p
                  key={`${version.id}-${bookIndex}-${chapter}-${n}`}
                  id={`v${n}`}
                  className={`scroll-mt-40 rounded-lg px-1.5 -mx-1.5 ${focused ? "bg-gold/15" : ""}`}
                >
                  <sup className="tabular mr-1.5 text-[0.68em] font-semibold text-gold">{n}</sup>
                  {text ? (
                    <VerseText text={text} />
                  ) : (
                    <span className="text-[0.88em] italic text-ink/50">
                      This verse isn&apos;t in the {version.abbreviation} text. Older versions such as the KJV include it.
                    </span>
                  )}
                </p>
              );
            })}
          </div>
        )}
      </article>

      <nav aria-label="Chapters" className="mt-10 grid grid-cols-2 gap-3">
        {previous ? (
          <button type="button" onClick={() => go(previous)} className="btn-secondary justify-start">
            <ChevronLeft aria-hidden className="h-4 w-4" />
            <span className="truncate">{formatReference(previous)}</span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button type="button" onClick={() => go(next)} className="btn-secondary justify-end">
            <span className="truncate">{formatReference(next)}</span>
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
        )}
      </nav>

      <p className="mt-8 text-xs text-ink/45">
        {version.name} ({version.abbreviation}, {version.year}). {version.licence}.
      </p>

      <PassagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(ref) => go(ref)}
        versionId={version.id}
        current={{ bookIndex, chapter }}
      />
    </div>
  );
}

function ChapterButton({
  target,
  direction,
  onGo,
}: {
  target: ChapterRef | null;
  direction: "previous" | "next";
  onGo: (to: ChapterRef) => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      disabled={!target}
      onClick={() => target && onGo(target)}
      aria-label={target ? `${direction === "previous" ? "Previous" : "Next"} chapter: ${formatReference(target)}` : `No ${direction} chapter`}
      className="btn-ghost btn-icon shrink-0"
    >
      <Icon aria-hidden className="h-5 w-5" />
    </button>
  );
}

function ChapterSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading chapter">
      {[92, 100, 85, 97, 70, 95, 88, 60].map((w, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-ink/10" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}
