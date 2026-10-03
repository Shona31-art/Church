import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";

const GAMES = [
  { href: "/dashboard/games/quiz", title: "Bible quiz", body: "10 questions — answers are checked on the server, no peeking." },
  { href: "/dashboard/games/word-search", title: "Word search", body: "A fresh grid of Bible names and places every time." },
  { href: "/dashboard/games/verse-puzzle", title: "Verse puzzle", body: "Unscramble five well-known verses back into order." },
];

const GAME_LABEL: Record<string, string> = { quiz: "Quiz", word_search: "Word search", verse_puzzle: "Verse puzzle" };

// Scoreboard window: the last 90 days keeps the query bounded as a church's
// history grows, and gives newer members a fair shot at the top.
const WINDOW_DAYS = 90;

export default async function GamesHubPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  const supabase = createClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const { data: attempts, error } = await supabase
    .from("bible_quiz_attempts")
    .select("user_id, score, total_questions, game_type, created_at, app_users(name)")
    .eq("church_id", me!.church_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  const totals = new Map<string, { name: string; points: number; games: number }>();
  for (const a of (attempts as any[]) ?? []) {
    const row = totals.get(a.user_id) ?? { name: a.app_users?.name ?? "Member", points: 0, games: 0 };
    row.points += a.score;
    row.games += 1;
    totals.set(a.user_id, row);
  }
  const leaderboard = [...totals.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const myRecent = ((attempts as any[]) ?? []).filter((a) => a.user_id === me!.id).slice(0, 5);
  const canManage = ["church_admin", "pastor"].includes(me!.role);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bible games</h1>
        {canManage && (
          <Link href="/dashboard/games/questions" className="text-sm border border-ink/15 rounded-lg px-4 py-2 hover:bg-ink/5">
            Manage quiz questions
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {GAMES.map((g) => (
          <Link key={g.href} href={g.href} className="card-elevated rounded-2xl p-5 hover:border-gold/60">
            <h2 className="font-semibold">{g.title}</h2>
            <p className="text-sm text-ink/60 mt-2">{g.body}</p>
            <p className="text-sm text-ember mt-4">Play →</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card-elevated rounded-2xl p-5" aria-labelledby="board-heading">
          <h2 id="board-heading" className="text-lg font-semibold">Church scoreboard</h2>
          <p className="text-xs text-ink/40 mb-3">Total points, last {WINDOW_DAYS} days</p>
          {error ? (
            <p className="text-sm text-danger" role="alert">⚠ Couldn't load the scoreboard — refresh to try again.</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-ink/50">No games played yet — be the first on the board!</p>
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((row, i) => (
                <li key={row.userId} className={`flex items-center justify-between text-sm ${row.userId === me!.id ? "font-semibold" : ""}`}>
                  <span>
                    <span className="inline-block w-6 text-ink/40 tabular-nums">{i + 1}.</span>
                    {row.name}{row.userId === me!.id ? " (you)" : ""}
                  </span>
                  <span className="tabular-nums text-ink/60">{row.points} pts · {row.games} games</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card-elevated rounded-2xl p-5" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-lg font-semibold mb-3">Your recent games</h2>
          {myRecent.length === 0 ? (
            <p className="text-sm text-ink/50">You haven't played yet. Pick a game above.</p>
          ) : (
            <ul className="space-y-2">
              {myRecent.map((a: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>{GAME_LABEL[a.game_type] ?? a.game_type}</span>
                  <span className="tabular-nums text-ink/60">
                    {a.score}/{a.total_questions} · {new Date(a.created_at).toLocaleDateString()}
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
