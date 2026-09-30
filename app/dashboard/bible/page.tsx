import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { BIBLE_BOOKS } from "@/lib/bible";

export default async function BibleHomePage() {
  const access = await checkModuleAccess("bible");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: bookmarks } = await supabase
    .from("bible_bookmarks")
    .select("book, chapter, verse")
    .eq("user_id", me!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Bible</h1>

      <Link href="/dashboard/bible/study" className="block card-elevated rounded-2xl p-4 mb-8 hover:border-gold/60">
        <p className="font-semibold">✨ Bible study</p>
        <p className="text-sm text-ink/50">Explain a passage, get a devotional, cross-references or a 7-day reading plan.</p>
      </Link>

      {bookmarks?.length ? (
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-2">Saved verses</h2>
          <div className="flex flex-wrap gap-2">
            {bookmarks.map((b, i) => (
              <Link
                key={i}
                href={`/dashboard/bible/read?book=${encodeURIComponent(b.book)}&chapter=${b.chapter}`}
                className="text-sm bg-white/60 border border-ink/10 px-3 py-1.5 rounded-lg"
              >
                {b.book} {b.chapter}:{b.verse}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-3">Books</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {BIBLE_BOOKS.map((book) => (
          <Link
            key={book}
            href={`/dashboard/bible/read?book=${encodeURIComponent(book)}&chapter=1`}
            className="text-sm border border-ink/10 rounded-lg px-3 py-2 bg-white/60 hover:bg-white"
          >
            {book}
          </Link>
        ))}
      </div>
    </div>
  );
}
