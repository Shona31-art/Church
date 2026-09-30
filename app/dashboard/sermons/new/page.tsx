import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { analyzeSermonTranscript } from "./actions";

export default async function NewSermonPage() {
  const access = await checkModuleAccess("sermon_ai");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role)) {
    return <p className="text-ink/60">Only pastors and church admins can add sermons.</p>;
  }

  async function createSermon(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["pastor", "church_admin"].includes(me.role)) return;

    const title = String(formData.get("title") || "").trim();
    const speaker = String(formData.get("speaker") || "");
    const sermonDate = String(formData.get("sermon_date") || "");
    const audioUrl = String(formData.get("audio_url") || "");
    const videoUrl = String(formData.get("video_url") || "");
    const transcript = String(formData.get("transcript") || "");

    if (!title) return;

    const analysis = await analyzeSermonTranscript(transcript);

    const supabase = createClient();
    await supabase.from("sermons").insert({
      church_id: me.church_id,
      created_by: me.id,
      title,
      speaker,
      sermon_date: sermonDate || new Date().toISOString().slice(0, 10),
      audio_url: audioUrl || null,
      video_url: videoUrl || null,
      transcript: transcript || null,
      ai_summary: analysis.summary || null,
      scripture_refs: analysis.scriptureRefs,
      discussion_questions: analysis.discussionQuestions,
      prayer_points: analysis.prayerPoints,
    });

    redirect("/dashboard/sermons");
  }

  return (
    <form action={createSermon} className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Add sermon</h1>

      <input
        name="title"
        placeholder="Sermon title"
        required
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="speaker"
        placeholder="Speaker"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        type="date"
        name="sermon_date"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="audio_url"
        placeholder="Audio URL (optional)"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="video_url"
        placeholder="Video URL (optional)"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <textarea
        name="transcript"
        placeholder="Paste the transcript here to auto-generate a summary, scripture references, discussion questions, and prayer points"
        rows={8}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <p className="text-xs text-ink/40">
        Leave transcript blank to add these manually later — AI generation
        needs ANTHROPIC_API_KEY configured.
      </p>

      <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
        Save sermon
      </button>
    </form>
  );
}
