import Link from "next/link";
import { Award, BookOpenText, CalendarCheck, Flame, Grid3x3, Library, ListOrdered, Medal, MessageSquareQuote, Route, Shuffle, Smile, SmilePlus, SquarePen, TextCursorInput, type LucideIcon, Puzzle, ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate, localInputToUtcIso, todayInAppZone } from "@/lib/format";
import { formatDuration } from "@/lib/chat";
import { GAMES, GAME_KEYS, LEVELS, LEVEL_LABELS, type GameKey, type Level } from "@/lib/games/catalog";
import { BADGES, currentStreak, dailyGame, type BadgeKey } from "@/lib/games/progression";
import { getAvatarUrls } from "@/lib/avatars";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";

const ICONS: Record<GameKey, LucideIcon> = {
  quiz: ListOrdered,
  crossword: SquarePen,
  word_search: Grid3x3,
  emoji: SmilePlus,
  scramble: Shuffle,
  verse_puzzle: BookOpenText,
  verse_fill: TextCursorInput,
  who_said: MessageSquareQuote,
  books_order: Library,
  maze: Route,
  jigsaw: Puzzle,
};

// Scoreboard window: the last 90 days keeps the query bounded as a church's
// history grows, and gives newer members a fair shot at the top.
const WINDOW_DAYS = 90;

export default async function GamesHubPage({ searchParams }: { searchParams: { kids?: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  // Kids mode needs no scoreboard data.
  if (searchParams.kids === "1") return <KidsHub />;

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const today = todayInAppZone();
  const todayStart = localInputToUtcIso(`${today}T00:00`) ?? new Date().toISOString();
  const todaysGame = dailyGame(today);

  const [{ data: attempts, error }, { data: badgeRows }] = await Promise.all([
    supabase
      .from("bible_quiz_attempts")
      .select("id, user_id, score, total_questions, points, level, mode, duration_ms, game_type, created_at, app_users(name)")
      .eq("church_id", me.church_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(3000),
    supabase.from("user_badges").select("badge_key, awarded_at").eq("user_id", me.id),
  ]);
  if (error) console.error("[games] scoreboard failed:", error.message);
  const rows = (attempts as any[]) ?? [];

  // Church scoreboard (Kids mode games don't count).
  const totals = new Map<string, { name: string; points: number; games: number }>();
  for (const a of rows.filter((r) => r.mode !== "kids")) {
    const row = totals.get(a.user_id) ?? { name: a.app_users?.name ?? "Member", points: 0, games: 0 };
    row.points += a.points ?? a.score;
    row.games += 1;
    totals.set(a.user_id, row);
  }
  const leaderboard = [...totals.entries()].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.points - a.points).slice(0, 10);

  // Today's challenge board: most points, then fastest.
  const daily = rows
    .filter((r) => r.mode === "daily" && r.created_at >= todayStart)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || (a.duration_ms ?? 0) - (b.duration_ms ?? 0));
  const myDaily = daily.find((r) => r.user_id === me.id);

  const mine = rows.filter((r) => r.user_id === me.id);
  const streak = currentStreak(
    mine.map((r) => todayInAppZone(new Date(r.created_at))),
    today
  );
  const badges = (badgeRows ?? []).filter((b) => b.badge_key in BADGES).sort((a, b) => b.awarded_at.localeCompare(a.awarded_at));
  const photos = await getAvatarUrls([...leaderboard.map((r) => r.userId), ...daily.slice(0, 5).map((r) => r.user_id)]);

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Bible games"
        description="Quizzes and puzzles at three levels. Every point counts towards your church's scoreboard."
        actions={
          <>
            <Link href="/dashboard/games?kids=1" className="btn-secondary">
              <Smile aria-hidden className="h-4 w-4" /> Kids mode
            </Link>
            {can(me.role, "manageQuizQuestions") && (
              <Link href="/dashboard/games/questions" className="btn-secondary">
                Manage quiz questions
              </Link>
            )}
          </>
        }
      />

      {/* Today's challenge + streak */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card-elevated rounded-2xl p-5 sm:p-6 lg:col-span-2" aria-labelledby="daily-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                <CalendarCheck aria-hidden className="h-3.5 w-3.5 text-gold" /> Today&apos;s challenge
              </p>
              <h2 id="daily-heading" className="mt-1 text-2xl font-semibold">
                {GAMES[todaysGame].title}
              </h2>
              <p className="mt-1 text-sm text-ink/60">The same puzzle for everyone in your church · Medium · timed · one try</p>
            </div>
            {myDaily ? (
              <p className="rounded-xl border border-success-line bg-success-tint px-4 py-2 text-sm text-success">
                Done — <span className="tabular font-semibold">{myDaily.points} pts</span> in {formatDuration(myDaily.duration_ms ?? 0)}
              </p>
            ) : (
              <Link href={`/dashboard/games/${GAMES[todaysGame].path}?mode=daily`} className="btn-primary">
                Take today&apos;s challenge
              </Link>
            )}
          </div>
          {daily.length > 0 && (
            <ol className="mt-5 space-y-2 border-t border-line pt-4">
              {daily.slice(0, 5).map((r, i) => (
                <li key={r.user_id} className={`flex items-center gap-3 text-sm ${r.user_id === me.id ? "font-semibold" : ""}`}>
                  <span className={`tabular w-5 text-center ${i < 3 ? "font-semibold text-gold-deep" : "text-ink/60"}`}>{i + 1}</span>
                  <Avatar name={r.app_users?.name ?? "Member"} src={photos.get(r.user_id)} size="xs" />
                  <span className="flex-1 truncate">{r.app_users?.name ?? "Member"}</span>
                  <span className="tabular text-ink/60">
                    {r.points} pts · {formatDuration(r.duration_ms ?? 0)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card-elevated flex flex-col justify-between rounded-2xl p-5 sm:p-6" aria-labelledby="streak-heading">
          <div>
            <p id="streak-heading" className="eyebrow flex items-center gap-1.5">
              <Flame aria-hidden className="h-3.5 w-3.5 text-gold" /> Your streak
            </p>
            <p className="tabular mt-1 font-display text-4xl font-semibold">
              {streak} <span className="text-lg font-medium text-ink/60">{streak === 1 ? "day" : "days"}</span>
            </p>
            <p className="mt-1 text-sm text-ink/60">{streak ? "Play today to keep it going." : "Play a game today to start one."}</p>
          </div>
          <div className="mt-4">
            <p className="eyebrow mb-2">Badges</p>
            {badges.length === 0 ? (
              <p className="text-sm text-ink/60">Finish your first game to earn one.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <li key={b.badge_key} title={`${BADGES[b.badge_key as BadgeKey].description} · ${formatDate(b.awarded_at)}`} className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-1 text-xs font-medium">
                    <Award aria-hidden className="h-3.5 w-3.5 text-gold" />
                    {BADGES[b.badge_key as BadgeKey].title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* All games */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  <Link key={level} href={`/dashboard/games/${game.path}?level=${level}`} className={level === "easy" ? "btn-primary btn-sm" : "btn-secondary btn-sm"} title={game.levels[level]}>
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
          <div className="mb-1 flex items-center gap-2">
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
                  <span className={`tabular w-6 text-center ${i < 3 ? "font-semibold text-gold-deep" : "text-ink/60"}`}>{i + 1}</span>
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

        {/* Opens and closes; tap a game to see its results and answers again. */}
        <details className="card-elevated group rounded-2xl p-5 sm:p-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              Your recent games{mine.length ? <span className="ml-1 text-base font-normal text-ink/60">({Math.min(mine.length, 20)})</span> : null}
            </h2>
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-ink/60 transition-transform group-open:rotate-180" />
          </summary>
          {mine.length === 0 ? (
            <p className="mt-4 text-sm text-ink/60">You haven&apos;t played yet. Pick a game and a level above.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {mine.slice(0, 20).map((a: any) => (
                <li key={a.id}>
                  <Link href={`/dashboard/games/attempts/${a.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-ink/[0.03]">
                    <span>
                      {GAMES[a.game_type as GameKey]?.title ?? a.game_type}
                      {a.level && <span className="text-ink/60"> · {LEVEL_LABELS[a.level as Level] ?? a.level}</span>}
                      {a.mode === "daily" && <span className="text-gold-deep"> · daily</span>}
                      {a.mode === "kids" && <span className="text-ink/60"> · kids</span>}
                    </span>
                    <span className="tabular flex items-center gap-1 text-ink/60">
                      {a.score}/{a.total_questions}
                      {a.points != null && ` · ${a.points} pts`} · {formatDate(a.created_at, { weekday: undefined, year: undefined })}
                      <ChevronRight aria-hidden className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </div>
  );
}

/** Kids mode: big, friendly cards; Easy only; no timers or scoreboard. */
function KidsHub() {
  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Kids' Bible games"
        description="Easy games with bigger buttons and no clock. Kids' scores stay off the church scoreboard."
        actions={
          <Link href="/dashboard/games" className="btn-secondary">
            Back to all games
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAME_KEYS.map((key) => {
          const Icon = ICONS[key];
          return (
            <Link key={key} href={`/dashboard/games/${GAMES[key].path}?mode=kids`} className="card-interactive flex items-center gap-4 rounded-3xl p-6">
              <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-line bg-parchment text-gold">
                <Icon className="h-8 w-8" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block font-display text-2xl font-semibold">{GAMES[key].title}</span>
                <span className="mt-0.5 block text-sm text-ink/60">{GAMES[key].summary}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
