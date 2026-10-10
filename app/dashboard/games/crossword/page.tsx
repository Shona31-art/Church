import { moduleGate } from "@/lib/gate";
import { isLevel } from "@/lib/games/catalog";
import { CrosswordGame } from "./CrosswordGame";

export default async function CrosswordPage({ searchParams }: { searchParams: { level?: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  return <CrosswordGame initialLevel={isLevel(searchParams.level) ? searchParams.level : undefined} />;
}
