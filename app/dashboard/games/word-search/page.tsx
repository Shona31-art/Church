import { checkModuleAccess } from "@/lib/paywall";
import { WordSearchPlayer } from "./WordSearchPlayer";

export default async function WordSearchPage() {
  const access = await checkModuleAccess("bible_games");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Word search</h1>
      <WordSearchPlayer />
    </div>
  );
}
