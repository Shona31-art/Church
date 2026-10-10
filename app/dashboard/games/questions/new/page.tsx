import { aiAssistAvailable } from "@/lib/features";
import { NewQuestionsForm } from "./NewQuestionsForm";

export default async function NewQuestionPage() {
  return <NewQuestionsForm aiAvailable={await aiAssistAvailable()} />;
}
