import Link from "next/link";
import { BookOpenText, Grid3x3, ListOrdered, Medal, SquarePen, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { GAMES, GAME_KEYS, LEVELS, LEVEL_LABELS, type GameKey, type Level } from "@/lib/games/catalog";
import { getAvatarUrls } from "@/lib/avatars";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";

const ICONS: Record<GameKey, LucideIcon> = {
  quiz: ListOrdered,
  crossword: SquarePen,
  word_search: Grid3x3,
  verse_puzzle: BookOpenText,
};

// Older scores (before levels) are labelled by game only.
const GAME_LABELS: Record<string, string> = Object.fromEntries(GAME_KEYS.map((k) => [k, GAMES[k].title]));

// Scoreboard window: the last 90 days keeps the query bounded as a church's
// history grows, and gives newer members a fair shot at the top.
const WINDOW_DAYS = 90;

export default async function GamesHubPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  // `points` arrived with bible_games_v3.sql; older rows (and databases
  // without the column) fall back to `score`.
  let { data: attempts, error } = await supabase
    .from("bible_quiz_attempts")
    .select("user_id, score, total_questions, points, level, game_type, created_at, app_users(name)")
    .eq("church_id", me.church_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error?.code === "42703") {
    ({ data: attempts, error } = await supabase
      .from("bible_quiz_attempts")
      .select("user_id, score, total_questions, game_type, created_at, app_users(name)")
      .eq("church_id", me.church_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000) as any);
  }
  if (error) console.error("[games] scoreboard failed:", error.message);

  const totals = new Map<string, { name: string; points: number; games: number }>();
  for (const a of (attempts as any[]) ?? []) {
    const row = totals.get(a.user_id) ?? { name: a.app_users?.name ?? "Member", points: 0, games: 0 };
    row.points += a.points ?? a.score;
    row.games += 1;
    totals.set(a.user_id, row);
  }
  const leaderboard = [...totals.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
  const photos = await getAvatarUrls(leaderboard.map((r) => r.userId));
  const myRecent = ((attempts as any[]) ?? []).filter((a) => a.user_id === me.id).slice(0, 6);

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title="Bible games"
        description="Quizzes and puzzles at three levels. Every point counts towards your church's scoreboard."
        actions={
          can(me.role, "manageQuizQuestions") ? (
            <Link href="/dashboard/games/questions" className="btn-secondary">
              Manage quiz questions
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GAME_KEYS.map((key) => {
          const game = GAMES[key];
          const Icon = ICONS[key];
          return (
            <section key={key} className="card-elevated flex flex-col rounded-2xl p-5" aria-labelledby={`game-${key}`}>
              <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-parchment text-gold">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <h2 id={`game-${key}`} className="mt-4 text-xl font-semibold">
                {game.title}
              </h2>
              <p className="mt-1.5 flex-1 text-sm text-ink/60">{game.summary}</p>
              <div className="mt-5 grid grid-cols-3 gap-1.5" role="group" aria-label={`Play ${game.title}`}>
                {LEVELS.map((level: Level) => (
                  <Link
                    key={level}
                    href={`/dashboard/games/${game.path}?level=${level}`}
                    className={level === "easy" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                    title={game.levels[level]}
                  >
                    {LEVEL_LABELS[level]}
                    <span className="sr-only"> — {game.levels[level]}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card-elevated rounded-2xl p-5 sm:p-6" aria-labelledby="board-heading">
          <div className="mb-4 flex items-center gap-2">
            <Medal aria-hidden className="h-5 w-5 text-gold" />
            <h2 id="board-heading" className="text-xl font-semibold">
              Church scoreboard
            </h2>
          </div>
          <p className="eyebrow mb-3">Points, last {WINDOW_DAYS} days</p>
          {error ? (
            <Alert tone="error">Couldn&apos;t load the scoreboard — refresh to try again.</Alert>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-ink/60">No games played yet — be the first on the board!</p>
          ) : (
            <ol className="space-y-2.5">
              {leaderboard.map((row, i) => (
                <li key={row.userId} className={`flex items-center gap-3 text-sm ${row.userId === me.id ? "font-semibold" : ""}`}>
                  <span className={`tabular w-6 text-center ${i < 3 ? "text-gold font-semibold" : "text-ink/40"}`}>{i + 1}</span>
                  <Avatar name={row.name} src={photos.get(row.userId)} size="xs" />
                  <span className="flex-1 truncate">
                    {row.name}
                    {row.userId === me.id ? " (you)" : ""}
                  </span>
                  <span className="tabular text-ink/60">
                    {row.points} pts · {row.games} {row.games === 1 ? "game" : "games"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card-elevated rounded-2xl p-5 sm:p-6" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="mb-4 text-xl font-semibold">
            Your recent games
          </h2>
          {myRecent.length === 0 ? (
            <p className="text-sm text-ink/60">You haven&apos;t played yet. Pick a game and a level above.</p>
          ) : (
            <ul className="divide-y divide-line">
              {myRecent.map((a: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    {GAME_LABELS[a.game_type] ?? a.game_type}
                    {a.level && <span className="text-ink/50"> · {LEVEL_LABELS[a.level as Level] ?? a.level}</span>}
                  </span>
                  <span className="tabular text-ink/60">
                    {a.score}/{a.total_questions}
                    {a.points != null && ` · ${a.points} pts`} · {formatDate(a.created_at, { weekday: undefined, year: undefined })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
