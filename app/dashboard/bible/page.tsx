import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { BIBLE_BOOKS } from "@/lib/bible";
import { moduleGate } from "@/lib/gate";
import { OfflineDownloads } from "@/components/bible/OfflineDownloads";
import { getChurchAccess } from "@/lib/paywall";

export default async function BibleHomePage() {
  const gate = await moduleGate("bible");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: bookmarks } = await supabase
    .from("bible_bookmarks")
    .select("book, chapter, verse")
    .eq("user_id", me!.id)
    .order("created_at", { ascending: false })
    .limit(5);
  // The AI study tool is its own (paid) feature; Basic has the reader only.
  const studyAvailable = Boolean((await getChurchAccess())?.modules.has("bible_study_ai"));

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Bible</h1>

      {studyAvailable && (
        <Link href="/dashboard/bible/study" className="block card-interactive rounded-2xl p-4 mb-8">
          <p className="font-semibold">✨ Bible study</p>
          <p className="text-sm text-ink/50">Explain a passage, get a devotional, cross-references or a 7-day reading plan.</p>
        </Link>
      )}

      {bookmarks?.length ? (
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-2">Saved verses</h2>
          <div className="flex flex-wrap gap-2">
            {bookmarks.map((b, i) => (
              <Link
                key={i}
                href={`/dashboard/bible/read?book=${encodeURIComponent(b.book)}&chapter=${b.chapter}`}
                className="text-sm bg-surface border border-ink/10 px-3 py-1.5 rounded-lg"
              >
                {b.book} {b.chapter}:{b.verse}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-8">
        <OfflineDownloads />
      </div>

      <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-3">Books</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {BIBLE_BOOKS.map((book) => (
          <Link
            key={book}
            href={`/dashboard/bible/read?book=${encodeURIComponent(book)}&chapter=1`}
            className="text-sm border border-ink/10 rounded-lg px-3 py-2 bg-surface hover:bg-surface"
          >
            {book}
          </Link>
        ))}
      </div>
    </div>
  );
}
