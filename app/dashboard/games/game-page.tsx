import { moduleGate } from "@/lib/gate";
import { isLevel, type GameKey } from "@/lib/games/catalog";
import { bestStars } from "@/lib/games/stages";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { GameScreen } from "./GameScreen";

/** Shared body of every game's page: plan check, your level progress, then ?level= and ?mode= (daily | kids). */
export async function renderGamePage(game: GameKey, searchParams: { level?: string; mode?: string }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const mode = searchParams.mode === "daily" || searchParams.mode === "kids" ? searchParams.mode : "practice";

  // Your best stars on each numbered level. Before games_jigsaw.sql adds the
  // column, this errors and the level map is simply not shown.
  // Kids mode has its own levels (attempts saved with mode "kids").
  let stageStars: Record<number, number> | null = null;
  if (mode === "practice" || mode === "kids") {
    const me = (await getCurrentAppUser())!;
    const base = createClient()
      .from("bible_quiz_attempts")
      .select("stage, score, total_questions")
      .eq("user_id", me.id)
      .eq("game_type", game)
      .not("stage", "is", null);
    const { data, error } = await (mode === "kids" ? base.eq("mode", "kids") : base.neq("mode", "kids"));
    if (!error) stageStars = bestStars(data ?? []);
  }
  return <GameScreen game={game} initialLevel={isLevel(searchParams.level) ? searchParams.level : undefined} mode={mode} stageStars={stageStars} />;
}
