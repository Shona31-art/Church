import { moduleGate } from "@/lib/gate";
import { isLevel, type GameKey } from "@/lib/games/catalog";
import { GameScreen } from "./GameScreen";

/** Shared body of every game's page: plan check, then ?level= and ?mode= (daily | kids). */
export async function renderGamePage(game: GameKey, searchParams: { level?: string; mode?: string }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const mode = searchParams.mode === "daily" || searchParams.mode === "kids" ? searchParams.mode : "practice";
  return <GameScreen game={game} initialLevel={isLevel(searchParams.level) ? searchParams.level : undefined} mode={mode} />;
}
