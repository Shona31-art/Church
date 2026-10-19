"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Type } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { BackLink } from "@/components/ui/PageHeader";
import { showToast } from "@/components/ui/Toaster";
import { BOOKS, bookIndexByName, nextChapter, previousChapter, readerHref, type BookText, type ChapterRef } from "@/lib/bible/books";
import { formatReference, verseRanges, type Reference } from "@/lib/bible/reference";
import { VERSIONS, versionById } from "@/lib/bible/versions";
import { BookLoadError, loadBook } from "@/lib/bible/load-book";
import { DEFAULT_SETTINGS, readLastPlace, readSettings, writeLastPlace, writeSettings, type ReaderSettings } from "@/lib/bible/reader-prefs";
import type { ChapterNote, HighlightColor } from "@/lib/bible/annotations";
import { PassagePicker } from "./PassagePicker";
import { VerseActionBar } from "./VerseActionBar";
import { ChapterText, type CompareText } from "./ChapterText";
import { ReaderSettingsDialog } from "./ReaderSettingsDialog";
import { NoteDialog } from "./NoteDialog";
import { ChapterNotes } from "./ChapterNotes";
import { useChapterAnnotations } from "./useChapterAnnotations";

const JOHN = BOOKS.findIndex((b) => b.name === "John");

type Load = { status: "loading" } | { status: "ready"; book: BookText } | { status: "error"; offline: boolean };
type NoteEditor = { noteId?: string; verse: number | null; initialText: string } | null;

/**
 * The Bible reader. The passage lives in the URL (?v=web&book=John&chapter=3&verse=16),
 * so links, refresh and the browser Back button all work. Moving between
 * chapters updates the URL with history.pushState — no server round trip —
 * and the text comes from the static files in public/bibles/.
 *
 * Tapping verses selects them and shows the action bar (highlight, bookmark,
 * note, copy, share). Highlights, bookmarks and notes are the member's own,
 * loaded per chapter through server actions (useChapterAnnotations).
 */
export function BibleReader() {
  const params = useSearchParams();
  const version = versionById(params.get("v"));
  const requestedBook = bookIndexByName(params.get("book"));
  const bookIndex = requestedBook >= 0 ? requestedBook : JOHN;
  const bookName = BOOKS[bookIndex].name;
  const chapter = clamp(Number(params.get("chapter")) || 1, 1, BOOKS[bookIndex].chapters);
  const verse = Number(params.get("verse")) || undefined;
  const verseEnd = Number(params.get("to")) || undefined;

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [noteEditor, setNoteEditor] = useState<NoteEditor>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Defaults on the server and first render, then this device's saved settings
  // (reading localStorage during render would mismatch the server HTML).
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [compareLoad, setCompareLoad] = useState<{ key: string; book: BookText | null; failed: boolean } | null>(null);
  const annotations = useChapterAnnotations(bookName, chapter, true);

  useEffect(() => setSettings(readSettings()), []);
  function updateSettings(next: ReaderSettings) {
    setSettings(next);
    writeSettings(next);
  }

  // The comparison version's copy of this book, when comparing.
  const compareVersion = VERSIONS.find((v) => v.id === settings.compareWith && v.id !== version.id) ?? null;
  useEffect(() => {
    if (!compareVersion) return;
    const key = `${compareVersion.id}:${bookIndex}`;
    let cancelled = false;
    setCompareLoad({ key, book: null, failed: false });
    loadBook(compareVersion.id, bookIndex)
      .then((book) => !cancelled && setCompareLoad({ key, book, failed: false }))
      .catch(() => !cancelled && setCompareLoad({ key, book: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [compareVersion?.id, bookIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setSelected([]);
  }, [version.id, bookIndex, chapter]);

  useEffect(() => {
    let cancelled = false;
    setLoad((current) => (current.status === "ready" && current.book.book === bookName ? current : { status: "loading" }));
    loadBook(version.id, bookIndex)
      .then((book) => !cancelled && setLoad({ status: "ready", book }))
      .catch((error) => !cancelled && setLoad({ status: "error", offline: error instanceof BookLoadError && error.offline }));
    return () => {
      cancelled = true;
    };
  }, [version.id, bookIndex, bookName, attempt]);

  // Jump to the requested verse once its chapter is on screen.
  const ready = load.status === "ready";
  useEffect(() => {
    if (!ready || !verse) return;
    document.getElementById(`v${verse}`)?.scrollIntoView({ block: "center" });
  }, [ready, verse, chapter, bookIndex]);

  const previous = previousChapter({ bookIndex, chapter });
  const next = nextChapter({ bookIndex, chapter });

  // ← and → move between chapters; Escape clears a selection. Not while
  // typing or while a popup is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || pickerOpen || noteEditor) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], dialog")) return;
      if (e.key === "ArrowLeft" && previous) go(previous);
      if (e.key === "ArrowRight" && next) go(next);
      if (e.key === "Escape") setSelected([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previous, next, go, pickerOpen, noteEditor]);

  const title = formatReference({ bookIndex, chapter });
  const verses = load.status === "ready" ? load.book.chapters[chapter - 1] ?? [] : [];
  const a = annotations.state.status === "ready" ? annotations.state.data : null;
  const notedVerses = new Set(a?.notes.map((n) => n.verse) ?? []);
  const compareCurrent = compareVersion && compareLoad?.key === `${compareVersion.id}:${bookIndex}` ? compareLoad : null;
  const compare: CompareText | null = compareVersion
    ? {
        abbreviation: compareVersion.abbreviation,
        verses: compareCurrent?.book ? compareCurrent.book.chapters[chapter - 1] ?? [] : null,
        failed: Boolean(compareCurrent?.failed),
      }
    : null;

  function toggle(n: number) {
    setSelected((s) => (s.includes(n) ? s.filter((v) => v !== n) : [...s, n].sort((x, y) => x - y)));
  }

  const selectionLabel = `${bookName} ${chapter}:${verseRanges(selected)}`;
  const selectedColors = new Set(selected.map((n) => a?.highlights[n] ?? null));
  const activeColor = selectedColors.size === 1 ? ([...selectedColors][0] as HighlightColor | null) : null;
  const allBookmarked = Boolean(a) && selected.length > 0 && selected.every((n) => a!.bookmarks.includes(n));

  function passageText() {
    const words = selected.map((n) => verses[n - 1]?.replace(/[[\]]/g, "")).filter(Boolean).join(" ");
    return `“${words}” ${selectionLabel} (${version.abbreviation})`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(passageText());
      showToast("Copied.");
      setSelected([]);
    } catch {
      showToast("Couldn't copy on this device. Select the text and copy it instead.", "error");
    }
  }

  async function share() {
    const text = passageText();
    if (navigator.share) {
      try {
        await navigator.share({ title: selectionLabel, text });
        setSelected([]);
      } catch (error) {
        // Closing the share sheet isn't an error.
        if ((error as Error).name !== "AbortError") showToast("Couldn't open sharing. Try Copy instead.", "error");
      }
    } else {
      await copy();
    }
  }

  function openNoteFor(verseNumber: number | null, existing?: ChapterNote) {
    const note = existing ?? a?.notes.find((n) => n.verse === verseNumber);
    setNoteEditor(note ? { noteId: note.id, verse: note.verse, initialText: note.note } : { verse: verseNumber, initialText: "" });
  }

  return (
    <div className={`mx-auto max-w-2xl ${selected.length ? "pb-56 md:pb-40" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <BackLink href="/dashboard/bible" label="Bible" className="" />
        <Link href={`/dashboard/bible/search?v=${version.id}`} className="btn-ghost btn-sm">
          <Search aria-hidden className="h-4 w-4" />
          Search
        </Link>
      </div>
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
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/60" />
        </button>
        {/* Shows just "WEB" so it fits a phone toolbar; the real (invisible)
            select on top keeps native keyboard/screen-reader behaviour and
            lists full names. */}
        <div className="relative shrink-0 rounded-xl border border-line hover:border-line-strong focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold">
          <span aria-hidden className="flex h-10 items-center gap-1 px-2.5 text-sm font-semibold">
            {version.abbreviation}
            <ChevronDown className="h-3.5 w-3.5 text-ink/60" />
          </span>
          <label htmlFor="bible-version" className="sr-only">
            Version
          </label>
          <select
            id="bible-version"
            value={version.id}
            onChange={(e) => go({ versionId: e.target.value, verse }, { replace: true })}
            className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0 focus-visible:outline-none"
          >
            {VERSIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.abbreviation} · {v.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-haspopup="dialog"
          aria-label="Reading settings: text size, layout and compare versions"
          className="btn-ghost btn-icon shrink-0"
        >
          <Type aria-hidden className="h-5 w-5" />
        </button>
        <ChapterButton target={next} direction="next" onGo={go} />
      </div>

      <article aria-labelledby="chapter-title" aria-busy={load.status === "loading"}>
        <h1 id="chapter-title" className="text-title font-semibold leading-tight sm:text-title-lg">
          {title}
        </h1>
        <div className="rule-gold mb-6 mt-3" />

        {annotations.state.status === "error" && load.status === "ready" && (
          <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/60" role="status">
            {annotations.state.message}
            {annotations.state.signedOut ? (
              <a className="link" href={`/login?next=${encodeURIComponent(readerHref({ versionId: version.id, bookIndex, chapter }))}`}>
                Sign in
              </a>
            ) : (
              <button type="button" className="link" onClick={annotations.retry}>
                Try again
              </button>
            )}
          </p>
        )}

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
          <>
            <p className="sr-only">Select a verse to highlight, bookmark, add a note, copy or share it.</p>
            <ChapterText
              verses={verses}
              versionAbbreviation={version.abbreviation}
              settings={settings}
              compare={compare}
              highlights={a?.highlights ?? {}}
              bookmarks={a?.bookmarks ?? []}
              notedVerses={notedVerses}
              selected={selected}
              focused={verse ? [verse, verseEnd ?? verse] : null}
              onToggle={toggle}
            />
          </>
        )}
      </article>

      {load.status === "ready" && a && (
        <ChapterNotes notes={a.notes} chapterLabel={title} onAdd={() => openNoteFor(null)} onEdit={(n) => openNoteFor(n.verse, n)} />
      )}

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

      <p className="mt-8 text-xs text-ink/60">
        {version.name} ({version.abbreviation}, {version.year}). {version.licence}.
      </p>

      {selected.length > 0 && (
        <VerseActionBar
          label={selectionLabel}
          annotationsReady={Boolean(a)}
          unavailableReason={annotations.state.status === "error" ? annotations.state.message : "Loading your highlights…"}
          activeColor={activeColor}
          anyHighlighted={selected.some((n) => a?.highlights[n])}
          allBookmarked={allBookmarked}
          onHighlight={(color) => {
            annotations.highlight(selected, color);
            setSelected([]);
          }}
          onBookmark={() => {
            annotations.bookmark(selected, !allBookmarked);
            setSelected([]);
          }}
          onNote={() => openNoteFor(selected[0])}
          onCopy={copy}
          onShare={share}
          onClear={() => setSelected([])}
        />
      )}

      <NoteDialog
        open={noteEditor !== null}
        title={noteEditor?.verse ? `Note on ${bookName} ${chapter}:${noteEditor.verse}` : `Note on ${title}`}
        initialText={noteEditor?.initialText ?? ""}
        canDelete={Boolean(noteEditor?.noteId)}
        onSave={async (text) => {
          const problem = await annotations.writeNote({ id: noteEditor?.noteId, verse: noteEditor?.verse ?? null, note: text });
          if (!problem) setSelected([]);
          return problem;
        }}
        onDelete={() => (noteEditor?.noteId ? annotations.removeNote(noteEditor.noteId) : Promise.resolve(false))}
        onClose={() => setNoteEditor(null)}
      />

      <ReaderSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        currentVersionId={version.id}
      />

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
