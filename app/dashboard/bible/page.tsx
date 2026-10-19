import Link from "next/link";
import { Bookmark, Highlighter, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { getChurchAccess } from "@/lib/paywall";
import { verseRefForDate } from "@/lib/bible";
import { BOOKS, OLD_TESTAMENT_BOOKS, bookIndexByName, readerHref } from "@/lib/bible/books";
import { parseReference } from "@/lib/bible/reference";
import { fetchVerse, passageText } from "@/lib/bible/text";
import type { HighlightColor } from "@/lib/bible/annotations";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContinueReading } from "@/components/bible/ContinueReading";
import { GoToPassage } from "@/components/bible/GoToPassage";
import { OfflineDownloads } from "@/components/bible/OfflineDownloads";
import { HIGHLIGHT_BG } from "@/components/bible/highlight-styles";

type SavedVerse = { book: string; chapter: number; verse: number; color?: HighlightColor };

/**
 * Bible home: continue reading, go to a passage, verse of the day, the
 * member's own recent bookmarks and highlights, offline downloads, and every
 * book. Saved-verse snippets are read from the local WEB text (lib/bible/text.ts).
 */
export default async function BibleHomePage() {
  const gate = await moduleGate("bible");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  const supabase = createClient();
  const verseRef = verseRefForDate(new Date());

  const [bookmarksRes, highlightsRes, verseText, access] = await Promise.all([
    supabase.from("bible_bookmarks").select("book, chapter, verse").eq("user_id", me!.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("bible_highlights").select("book, chapter, verse, color").eq("user_id", me!.id).order("updated_at", { ascending: false }).limit(6),
    fetchVerse(verseRef),
    getChurchAccess(),
  ]);
  // A failed lookup (e.g. migration #27 not run yet) just shows the empty state, never breaks the page.
  if (bookmarksRes.error) console.error("[bible] bookmarks:", bookmarksRes.error.message);
  if (highlightsRes.error) console.error("[bible] highlights:", highlightsRes.error.message);

  const [bookmarks, highlights] = await Promise.all([withText(bookmarksRes.data ?? []), withText((highlightsRes.data ?? []) as SavedVerse[])]);
  // The AI study tool is its own (paid) feature; Basic has the reader only.
  const studyAvailable = Boolean(access?.modules.has("bible_study_ai"));
  const verseOfDay = parseReference(verseRef);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Bible"
        description="Read, search and study in four versions, on any device, even offline."
        actions={
          <Link href="/dashboard/bible/search" className="btn-secondary">
            <Search aria-hidden className="h-4 w-4" />
            Search
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ContinueReading />
        <GoToPassage />
      </div>

      <section aria-labelledby="votd-title" className="card-elevated mt-4 rounded-2xl p-5 sm:p-6">
        <h2 id="votd-title" className="eyebrow text-gold">
          Verse of the day
        </h2>
        {verseText ? (
          <blockquote className="mt-3 font-display text-lg leading-relaxed">“{verseText}”</blockquote>
        ) : (
          <p className="mt-3 text-sm text-ink/60">Couldn&apos;t load today&apos;s verse. Open it in the reader instead.</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {verseOfDay && (
            <Link href={readerHref({ ...verseOfDay })} className="link">
              {verseRef} <span className="font-normal text-ink/60">(WEB)</span>
            </Link>
          )}
          {studyAvailable && (
            <Link href={`/dashboard/bible/study?ref=${encodeURIComponent(verseRef)}`} className="link">
              Study this verse →
            </Link>
          )}
        </div>
      </section>

      {studyAvailable && (
        <Link href="/dashboard/bible/study" className="card-interactive mt-4 flex items-start gap-4 rounded-2xl p-5">
          <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <span>
            <span className="block font-semibold">Bible study</span>
            <span className="block text-sm text-ink/60">Explain a passage, get a devotional, cross-references or a 7-day reading plan.</span>
          </span>
        </Link>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <SavedList
          title="Bookmarks"
          icon={<Bookmark aria-hidden className="h-4 w-4 text-gold" />}
          items={bookmarks}
          empty="Tap a verse in the reader and choose Bookmark to keep it here."
        />
        <SavedList
          title="Highlights"
          icon={<Highlighter aria-hidden className="h-4 w-4 text-gold" />}
          items={highlights}
          empty="Tap a verse in the reader and pick a colour to highlight it."
        />
      </div>

      <div className="mt-8">
        <OfflineDownloads />
      </div>

      <section aria-labelledby="books-title" className="mt-10">
        <h2 id="books-title" className="text-xl font-semibold">
          Books
        </h2>
        <BookGrid title="Old Testament" from={0} to={OLD_TESTAMENT_BOOKS} />
        <BookGrid title="New Testament" from={OLD_TESTAMENT_BOOKS} to={BOOKS.length} />
      </section>
    </div>
  );
}

async function withText<T extends SavedVerse>(rows: T[]): Promise<(T & { text: string | null; bookIndex: number })[]> {
  return Promise.all(
    rows.map(async (r) => {
      const bookIndex = bookIndexByName(r.book);
      const text = bookIndex >= 0 ? await passageText({ bookIndex, chapter: r.chapter, verse: r.verse }) : null;
      return { ...r, bookIndex, text };
    }),
  );
}

function SavedList({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: (SavedVerse & { text: string | null; bookIndex: number })[];
  empty: string;
}) {
  const id = `saved-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="card-elevated rounded-2xl p-5">
      <h2 id={id} className="mb-3 flex items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
      </h2>
      {items.length ? (
        <ul className="space-y-1">
          {items
            .filter((v) => v.bookIndex >= 0)
            .map((v) => (
              <li key={`${v.book}-${v.chapter}-${v.verse}`}>
                <Link
                  href={readerHref({ bookIndex: v.bookIndex, chapter: v.chapter, verse: v.verse })}
                  className="-mx-2 flex gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-raised"
                >
                  {v.color && <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${HIGHLIGHT_BG[v.color]} ring-1 ring-line-strong`} />}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {v.book} {v.chapter}:{v.verse}
                      {v.color && <span className="sr-only"> (highlighted {v.color})</span>}
                    </span>
                    {v.text && <span className="line-clamp-2 block text-sm text-ink/60">{v.text}</span>}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/60">{empty}</p>
      )}
    </section>
  );
}

function BookGrid({ title, from, to }: { title: string; from: number; to: number }) {
  return (
    <>
      <h3 className="eyebrow mb-2 mt-5">{title}</h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {BOOKS.slice(from, to).map((b, i) => (
          <li key={b.slug}>
            <Link
              href={readerHref({ bookIndex: from + i, chapter: 1 })}
              className="block rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium hover:border-line-strong hover:bg-surface-raised"
            >
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
