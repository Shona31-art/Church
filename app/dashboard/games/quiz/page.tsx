import { getQuizQuestions } from "./actions";
import { QuizPlayer } from "./QuizPlayer";
import { moduleGate } from "@/lib/gate";

export default async function QuizPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;

  const questions = await getQuizQuestions(10);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Bible quiz</h1>
      <QuizPlayer questions={questions} />
    </div>
  );
}
