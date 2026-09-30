import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function SermonDetailPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("sermon_ai");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: sermon } = await supabase.from("sermons").select("*").eq("id", params.id).single();
  if (!sermon) notFound();

  const { data: myNotes } = await supabase
    .from("sermon_notes")
    .select("*")
    .eq("sermon_id", params.id)
    .eq("user_id", me!.id)
    .order("created_at", { ascending: false });

  async function addNote(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const note = String(formData.get("note") || "").trim();
    if (!note) return;

    const supabase = createClient();
    await supabase.from("sermon_notes").insert({ sermon_id: params.id, user_id: me.id, note });
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{sermon.title}</h1>
        <p className="text-sm text-ink/50">
          {sermon.speaker && `${sermon.speaker} · `}
          {new Date(sermon.sermon_date).toLocaleDateString()}
        </p>
      </div>

      {sermon.video_url && (
        <video controls className="w-full rounded-lg" src={sermon.video_url} />
      )}
      {!sermon.video_url && sermon.audio_url && (
        <audio controls className="w-full" src={sermon.audio_url} />
      )}

      {sermon.ai_summary && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-2">Summary</h2>
          <p className="text-ink/70">{sermon.ai_summary}</p>
        </section>
      )}

      {sermon.scripture_refs?.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-2">Scriptures</h2>
          <p className="text-ember">{sermon.scripture_refs.join(" · ")}</p>
        </section>
      )}

      {sermon.discussion_questions?.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-2">
            Discussion questions
          </h2>
          <ul className="list-disc list-inside text-ink/70 space-y-1">
            {sermon.discussion_questions.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {sermon.prayer_points?.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-2">Prayer points</h2>
          <ul className="list-disc list-inside text-ink/70 space-y-1">
            {sermon.prayer_points.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-ink/10 pt-6">
        <h2 className="text-sm uppercase tracking-wide text-ink/50 mb-2">
          My notes (private)
        </h2>
        <form action={addNote} className="mb-4 space-y-2">
          <textarea
            name="note"
            placeholder="Jot down your own thoughts..."
            rows={3}
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          />
          <button type="submit" className="bg-ember text-white px-4 py-2 rounded-lg text-sm">
            Save note
          </button>
        </form>
        <div className="space-y-2">
          {myNotes?.map((n) => (
            <div key={n.id} className="border border-ink/10 rounded-lg p-3 bg-white/60 text-sm">
              {n.note}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
