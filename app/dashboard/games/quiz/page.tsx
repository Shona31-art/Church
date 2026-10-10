import { moduleGate } from "@/lib/gate";
import { isLevel } from "@/lib/games/catalog";
import { QuizGame } from "./QuizGame";

export default async function QuizPage({ searchParams }: { searchParams: { level?: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  return <QuizGame initialLevel={isLevel(searchParams.level) ? searchParams.level : undefined} />;
}
