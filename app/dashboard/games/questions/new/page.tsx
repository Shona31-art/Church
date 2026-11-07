import { moduleGate } from "@/lib/gate";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { PermissionDenied } from "@/components/ui/Gates";
import { NewQuestionsForm } from "./NewQuestionsForm";

export default async function NewQuestionPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageQuizQuestions")) {
    return <PermissionDenied message="Only church admins and pastors can add quiz questions." backHref="/dashboard/games" />;
  }
  return <NewQuestionsForm />;
}
