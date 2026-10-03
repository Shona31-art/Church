import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { fetchChapter, BIBLE_BOOKS } from "@/lib/bible";
import { moduleGate } from "@/lib/gate";

export default async function BibleReaderPage({
  searchParams,
}: {
  searchParams: { book?: string; chapter?: string };
}) {
  const gate = await moduleGate("bible");
  if (gate) return gate;

  const book = searchParams.book || "John";
  const chapter = parseInt(searchParams.chapter || "1", 10);

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const [verses, { data: myBookmarks }, { data: myNotes }] = await Promise.all([
    fetchChapter(book, chapter),
    supabase.from("bible_bookmarks").select("verse").eq("user_id", me!.id).eq("book", book).eq("chapter", chapter),
    supabase
      .from("bible_notes")
      .select("*")
      .eq("user_id", me!.id)
      .eq("book", book)
      .eq("chapter", chapter)
      .order("created_at", { ascending: false }),
  ]);

  const bookmarkedVerses = new Set((myBookmarks || []).map((b) => b.verse));
  const bookIndex = BIBLE_BOOKS.indexOf(book);

  async function toggleBookmark(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const verse = parseInt(String(formData.get("verse")), 10);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("bible_bookmarks")
      .select("id")
      .eq("user_id", me.id)
      .eq("book", book)
      .eq("chapter", chapter)
      .eq("verse", verse)
      .maybeSingle();

    if (existing) {
      await supabase.from("bible_bookmarks").delete().eq("id", existing.id);
    } else {
      await supabase.from("bible_bookmarks").insert({ user_id: me.id, book, chapter, verse });
    }

    redirect(`/dashboard/bible/read?book=${encodeURIComponent(book)}&chapter=${chapter}`);
  }

  async function addNote(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const note = String(formData.get("note") || "").trim();
    const verseRaw = String(formData.get("verse") || "");
    if (!note) return;

    const supabase = createClient();
    await supabase.from("bible_notes").insert({
      user_id: me.id,
      book,
      chapter,
      verse: verseRaw ? parseInt(verseRaw, 10) : null,
      note,
    });

    redirect(`/dashboard/bible/read?book=${encodeURIComponent(book)}&chapter=${chapter}`);
  }

  async function deleteNote(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const supabase = createClient();
    await supabase.from("bible_notes").delete().eq("id", String(formData.get("id"))).eq("user_id", me.id);

    redirect(`/dashboard/bible/read?book=${encodeURIComponent(book)}&chapter=${chapter}`);
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          {book} {chapter}
        </h1>
        <div className="flex gap-3 text-sm">
          {chapter > 1 && (
            <Link href={`/dashboard/bible/read?book=${encodeURIComponent(book)}&chapter=${chapter - 1}`} className="text-ember">
              ← Prev
            </Link>
          )}
          <Link href={`/dashboard/bible/read?book=${encodeURIComponent(book)}&chapter=${chapter + 1}`} className="text-ember">
            Next →
          </Link>
        </div>
      </div>

      {!verses.length && (
        <p className="text-ink/40 text-sm">
          Couldn't load this chapter — check the book name and chapter number.
        </p>
      )}

      <div className="space-y-1">
        {verses.map((v) => (
          <div key={v.verse} className="group flex gap-2 items-start">
            <span className="text-xs text-ink/30 mt-1 w-5 shrink-0">{v.verse}</span>
            <p className="text-ink/80 flex-1">{v.text}</p>
            <form action={toggleBookmark}>
              <input type="hidden" name="verse" value={v.verse} />
              <button type="submit" className="text-xs opacity-0 group-hover:opacity-100">
                {bookmarkedVerses.has(v.verse) ? "★" : "☆"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink/30 mt-6">
        Text: World English Bible (public domain), via bible-api.com
      </p>

      <section className="mt-8 border-t border-ink/10 pt-6">
        <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-3">
          My notes on this chapter (private)
        </h2>
        <form action={addNote} className="flex gap-2 mb-4">
          <input
            name="verse"
            type="number"
            placeholder="Verse #"
            className="w-20 border border-ink/20 rounded-lg px-2 py-2 text-sm"
          />
          <input
            name="note"
            placeholder="Add a note..."
            required
            className="flex-1 border border-ink/20 rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-ember text-white px-4 py-2 rounded-lg text-sm">
            Save
          </button>
        </form>
        <div className="space-y-2">
          {myNotes?.map((n) => (
            <div key={n.id} className="border border-ink/10 rounded-lg p-3 bg-white/60 text-sm flex justify-between gap-2">
              <div>
                {n.verse && <span className="text-ember text-xs mr-2">v{n.verse}</span>}
                {n.note}
              </div>
              <form action={deleteNote}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className="text-xs text-ink/30 shrink-0">
                  delete
                </button>
              </form>
            </div>
          ))}
          {!myNotes?.length && <p className="text-ink/40 text-sm">No notes yet on this chapter.</p>}
        </div>
      </section>
    </div>
  );
}
