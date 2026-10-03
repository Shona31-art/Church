import { WordSearchPlayer } from "./WordSearchPlayer";
import { moduleGate } from "@/lib/gate";

export default async function WordSearchPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Word search</h1>
      <WordSearchPlayer />
    </div>
  );
}
