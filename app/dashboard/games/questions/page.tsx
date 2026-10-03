import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PermissionDenied } from "@/components/ui/Gates";
import { DeleteQuestionButton } from "./DeleteQuestionButton";

export default async function QuestionsPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageQuizQuestions")) {
    return <PermissionDenied message="Only church admins and pastors can manage quiz questions." backHref="/dashboard/games" />;
  }

  const supabase = createClient();
  const [{ data: myQuestions }, { count: globalCount }] = await Promise.all([
    supabase.from("bible_quiz_questions").select("id, question, category, difficulty").eq("church_id", me.church_id).order("created_at", { ascending: false }).limit(500),
    supabase.from("bible_quiz_questions").select("id", { count: "exact", head: true }).is("church_id", null),
  ]);

  const addButton = (
    <Link href="/dashboard/games/questions/new" className="btn-primary">
      Add questions
    </Link>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/dashboard/games", label: "Games" }}
        title="Quiz questions"
        description={`Every church shares ${globalCount ?? 0} built-in questions. These are your church's own, mixed in when your members play.`}
        actions={addButton}
      />
      {!myQuestions?.length ? (
        <EmptyState title="No custom questions yet" description="Write your own — about your church's sermon series, for example — or generate a batch with AI." action={addButton} />
      ) : (
        <ul className="card-elevated rounded-2xl divide-y divide-line">
          {myQuestions.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">{q.question}</p>
                <div className="mt-1 flex gap-2">
                  <StatusBadge tone="neutral">{(q.category ?? "general").replace("_", " ")}</StatusBadge>
                  <StatusBadge tone="neutral">{q.difficulty}</StatusBadge>
                </div>
              </div>
              <DeleteQuestionButton id={q.id} question={q.question} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
