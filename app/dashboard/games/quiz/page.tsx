import { checkModuleAccess } from "@/lib/paywall";
import { getQuizQuestions } from "./actions";
import { QuizPlayer } from "./QuizPlayer";

export default async function QuizPage() {
  const access = await checkModuleAccess("bible_games");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const questions = await getQuizQuestions(10);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Bible quiz</h1>
      <QuizPlayer questions={questions} />
    </div>
  );
}
