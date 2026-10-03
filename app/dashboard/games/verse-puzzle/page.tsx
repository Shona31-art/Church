import { VersePuzzlePlayer } from "./VersePuzzlePlayer";
import { moduleGate } from "@/lib/gate";

export default async function VersePuzzlePage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Verse puzzle</h1>
      <p className="text-sm text-ink/50 mt-1 mb-6">
        Put the words back in order. Five verses per round — one point for each you solve.
      </p>
      <VersePuzzlePlayer />
    </div>
  );
}
