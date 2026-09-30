import { checkModuleAccess } from "@/lib/paywall";
import { VersePuzzlePlayer } from "./VersePuzzlePlayer";

export default async function VersePuzzlePage() {
  const access = await checkModuleAccess("bible_games");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

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
