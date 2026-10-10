import { moduleGate } from "@/lib/gate";
import { isLevel } from "@/lib/games/catalog";
import { WordSearchGame } from "./WordSearchGame";

export default async function WordSearchPage({ searchParams }: { searchParams: { level?: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  return <WordSearchGame initialLevel={isLevel(searchParams.level) ? searchParams.level : undefined} />;
}
