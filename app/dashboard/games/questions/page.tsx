import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function QuestionsPage() {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return <p className="text-ink/60">Only church admins and pastors can manage questions.</p>;
  }

  const supabase = createClient();
  const { data: myQuestions } = await supabase
    .from("bible_quiz_questions")
    .select("id, question, category, difficulty")
    .eq("church_id", me.church_id)
    .order("created_at", { ascending: false });

  const { count: globalCount } = await supabase
    .from("bible_quiz_questions")
    .select("*", { count: "exact", head: true })
    .is("church_id", null);

  async function deleteQuestion(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["church_admin", "pastor"].includes(me.role)) return;

    const supabase = createClient();
    await supabase
      .from("bible_quiz_questions")
      .delete()
      .eq("id", String(formData.get("id")))
      .eq("church_id", me.church_id);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Manage quiz questions</h1>
        <Link
          href="/dashboard/games/questions/new"
          className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add questions
        </Link>
      </div>
      <p className="text-xs text-ink/40 mb-6">
        Every church also shares {globalCount ?? 0} built-in questions. These
        are your church's own additions, mixed in when your members play.
      </p>

      <div className="space-y-2">
        {myQuestions?.map((q) => (
          <div key={q.id} className="flex items-center justify-between border border-ink/10 rounded-lg p-3 bg-white/60">
            <div>
              <p className="text-sm">{q.question}</p>
              <p className="text-xs text-ink/40 capitalize">
                {q.category?.replace("_", " ")} · {q.difficulty}
              </p>
            </div>
            <form action={deleteQuestion}>
              <input type="hidden" name="id" value={q.id} />
              <button type="submit" className="text-xs text-red-700 shrink-0">
                Delete
              </button>
            </form>
          </div>
        ))}
        {!myQuestions?.length && (
          <p className="text-ink/40 text-sm">
            No custom questions yet — add your own or generate some with AI.
          </p>
        )}
      </div>
    </div>
  );
}
