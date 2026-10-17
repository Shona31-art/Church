"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { BOOKS, readerHref } from "@/lib/bible/books";
import { loadBook } from "@/lib/bible/load-book";
import { VERSIONS, versionById } from "@/lib/bible/versions";
import { booksFor, buildMatcher, matchRanges, MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, searchBook, type SearchHit, type Testament } from "@/lib/bible/search";

const PAGE = 100;

type Run =
  | { status: "idle" }
  | { status: "searching"; done: number; total: number; hits: SearchHit[] }
  | { status: "done"; hits: SearchHit[]; failedBooks: number }
  | { status: "invalid" };

/**
 * Search a whole version for words or a phrase. The query, version and
 * testament live in the URL, so a search can be shared or revisited with
 * Back. Books are fetched one by one from public/bibles/ (or the phone's
 * offline copy) and searched in the browser; results stream in as they're found.
 */
export function BibleSearch() {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const version = versionById(params.get("v"));
  const testament = (["ot", "nt"].includes(params.get("t") ?? "") ? params.get("t") : "all") as Testament;

  const [draft, setDraft] = useState(query);
  const [run, setRun] = useState<Run>({ status: "idle" });
  const [shown, setShown] = useState(PAGE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    setShown(PAGE);
    if (!query.trim()) return setRun({ status: "idle" });
    const matcher = buildMatcher(query);
    if (!matcher) return setRun({ status: "invalid" });

    let cancelled = false;
    const books = booksFor(testament);
    (async () => {
      const hits: SearchHit[] = [];
      let failed = 0;
      setRun({ status: "searching", done: 0, total: books.length, hits: [] });
      for (let i = 0; i < books.length; i++) {
        try {
          hits.push(...searchBook(books[i], await loadBook(version.id, books[i]), matcher));
        } catch {
          failed++;
        }
        if (cancelled) return;
        setRun({ status: "searching", done: i + 1, total: books.length, hits: [...hits] });
      }
      setRun({ status: "done", hits, failedBooks: failed });
    })();
    return () => {
      cancelled = true;
    };
  }, [query, version.id, testament, attempt]);

  function navigate(next: { q?: string; v?: string; t?: Testament }) {
    const p = new URLSearchParams();
    const q = next.q ?? query;
    if (q.trim()) p.set("q", q.trim());
    p.set("v", next.v ?? version.id);
    const t = next.t ?? testament;
    if (t !== "all") p.set("t", t);
    window.history.pushState(null, "", `/dashboard/bible/search?${p}`);
  }

  const hits = run.status === "searching" || run.status === "done" ? run.hits : [];
  const terms = useMemo(() => buildMatcher(query)?.terms ?? [], [query]);

  return (
    <div className="max-w-2xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: draft });
        }}
        className="card-elevated mb-6 space-y-3 rounded-2xl p-4"
      >
        <label htmlFor="bible-search" className="label">
          Search the Bible
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              id="bible-search"
              type="search"
              className="input pl-9"
              placeholder='e.g. shepherd, or "love one another"'
              value={draft}
              maxLength={MAX_QUERY_LENGTH}
              enterKeyHint="search"
              autoComplete="off"
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby="bible-search-hint"
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </div>
        <p id="bible-search-hint" className="hint mt-0">
          Finds verses with all your words. Put a phrase in quotes to find it exactly.
        </p>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="search-version" className="sr-only">
              Version
            </label>
            <select id="search-version" className="input w-auto py-2" value={version.id} onChange={(e) => navigate({ v: e.target.value })}>
              {VERSIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.abbreviation} · {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-testament" className="sr-only">
              Books to search
            </label>
            <select id="search-testament" className="input w-auto py-2" value={testament} onChange={(e) => navigate({ t: e.target.value as Testament })}>
              <option value="all">Whole Bible</option>
              <option value="ot">Old Testament</option>
              <option value="nt">New Testament</option>
            </select>
          </div>
        </div>
      </form>

      {run.status === "idle" && (
        <p className="text-sm text-ink/55">The first search in a version downloads it (about {mb(version.downloadBytes)} MB); after that it&apos;s quick.</p>
      )}

      {run.status === "invalid" && (
        <p className="text-sm text-ink/60" role="status">
          Type at least {MIN_QUERY_LENGTH} letters to search.
        </p>
      )}

      {(run.status === "searching" || run.status === "done") && (
        <div aria-live="polite" className="mb-4 text-sm text-ink/60">
          {run.status === "searching" ? (
            <p role="status">
              Searching… {run.done} of {run.total} books · {hits.length.toLocaleString("en-ZA")} found so far
            </p>
          ) : (
            <p role="status">
              {hits.length ? `${hits.length.toLocaleString("en-ZA")} ${hits.length === 1 ? "verse" : "verses"}` : "No verses"} found for “{query}” in the{" "}
              {version.abbreviation}
              {testament === "ot" ? " Old Testament" : testament === "nt" ? " New Testament" : ""}.
            </p>
          )}
        </div>
      )}

      {run.status === "done" && run.failedBooks > 0 && (
        <Alert
          tone="warning"
          title={`${run.failedBooks} ${run.failedBooks === 1 ? "book" : "books"} couldn't be searched`}
          className="mb-4"
          action={
            <button type="button" className="btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          }
        >
          Check your connection. Results below may be incomplete.
        </Alert>
      )}

      {run.status === "done" && !hits.length && !run.failedBooks && (
        <p className="text-sm text-ink/55">Try fewer words, a shorter word (e.g. “pray” also finds “prayer”), or another version.</p>
      )}

      {hits.length > 0 && (
        <ol className="space-y-2">
          {hits.slice(0, shown).map((h) => (
            <li key={`${h.bookIndex}-${h.chapter}-${h.verse}`}>
              <Link
                href={readerHref({ versionId: version.id, bookIndex: h.bookIndex, chapter: h.chapter, verse: h.verse })}
                className="card-interactive block rounded-xl px-4 py-3"
              >
                <p className="text-sm font-semibold">
                  {BOOKS[h.bookIndex].name} {h.chapter}:{h.verse}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink/80">
                  <Marked text={h.text} terms={terms} />
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {hits.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn-secondary mt-4 w-full">
          Show more ({(hits.length - shown).toLocaleString("en-ZA")} left)
        </button>
      )}
    </div>
  );
}

/** Verse text with the searched words in <mark>. Brackets (supplied words) dropped, as the ranges are computed without them. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const plain = text.replace(/[[\]]/g, "");
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of matchRanges(plain, terms)) {
    if (start > at) parts.push(plain.slice(at, start));
    parts.push(
      <mark key={start} className="rounded bg-gold/25 px-0.5 text-ink">
        {plain.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  parts.push(plain.slice(at));
  return <>{parts}</>;
}

function mb(bytes: number) {
  return (bytes / 1_000_000).toFixed(1);
}
