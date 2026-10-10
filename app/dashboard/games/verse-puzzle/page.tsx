import { moduleGate } from "@/lib/gate";
import { isLevel } from "@/lib/games/catalog";
import { VersePuzzleGame } from "./VersePuzzleGame";

export default async function VersePuzzlePage({ searchParams }: { searchParams: { level?: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  return <VersePuzzleGame initialLevel={isLevel(searchParams.level) ? searchParams.level : undefined} />;
}
