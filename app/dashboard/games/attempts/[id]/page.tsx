import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { GAMES, LEVEL_LABELS, type GameKey, type Level } from "@/lib/games/catalog";
import { formatDateTime } from "@/lib/format";
import { formatDuration } from "@/lib/chat";
import { PageHeader } from "@/components/ui/PageHeader";
import { ENGINES, type ReviewItem } from "../../engine";
import { ReviewList } from "../../ReviewList";

/** A past game of yours: the results screen again, with your answers when they were saved. */
export default async function AttemptPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;

  // Only your own games.
  const { data: attempt } = await createClient()
    .from("bible_quiz_attempts")
    .select("id, user_id, game_type, score, total_questions, points, level, mode, duration_ms, session_id, created_at")
    .eq("id", params.id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!attempt) notFound();

  const game = GAMES[attempt.game_type as GameKey];
  let review: ReviewItem[] | null = null;
  let timed = false;
  if (attempt.session_id) {
    // game_sessions holds the answer key, so only the server reads it — checked against you.
    const { data: session, error } = await createAdminClient()
      .from("game_sessions")
      .select("puzzle, progress, answers, timed, user_id")
      .eq("id", attempt.session_id)
      .eq("user_id", me.id)
      .maybeSingle();
    if (error && !/answers/.test(error.message)) console.error("[games] attempt load failed:", error.message);
    timed = Boolean(session?.timed);
    const engine = ENGINES[attempt.game_type as GameKey];
    if (session?.answers != null && engine?.review) {
      try {
        review = engine.review(session.puzzle, session.progress, session.answers);
      } catch {
        review = null;
      }
    }
  }

  const correct = attempt.score ?? 0;
  const max = attempt.total_questions ?? 0;
  const perfect = max > 0 && correct === max;
  const hasReviewKind = Boolean(ENGINES[attempt.game_type as GameKey]?.review);

  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: "/dashboard/games", label: "Games" }} title={game?.title ?? "Game"} description={`Played ${formatDateTime(attempt.created_at)}`} />
      <div className="card-elevated rounded-2xl p-8 text-center">
        <span aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-parchment text-gold">
          <Trophy className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <p className="tabular mt-4 font-display text-4xl font-semibold">
          {correct} / {max}
        </p>
        <p className="mt-2 text-ink/60">{perfect ? "Perfect!" : correct >= max * 0.7 ? "Well done!" : "Good effort."}</p>
        <dl className={`mx-auto mt-6 grid max-w-sm gap-3 text-sm ${timed ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-xl border border-line p-3">
            <dt className="eyebrow">Points</dt>
            <dd className="tabular mt-1 text-lg font-semibold">{attempt.points ?? 0}</dd>
          </div>
          {timed && (
            <div className="rounded-xl border border-line p-3">
              <dt className="eyebrow">Time</dt>
              <dd className="tabular mt-1 text-lg font-semibold">{formatDuration(attempt.duration_ms ?? 0)}</dd>
            </div>
          )}
          <div className="rounded-xl border border-line p-3">
            <dt className="eyebrow">Level</dt>
            <dd className="mt-1 text-lg font-semibold">{LEVEL_LABELS[attempt.level as Level] ?? attempt.level}</dd>
          </div>
        </dl>
        {review && review.length > 0 ? (
          <ReviewList items={review} />
        ) : hasReviewKind ? (
          <p className="mt-6 text-sm text-ink/60">The answers for this game weren&apos;t saved. Games you play from now on keep them.</p>
        ) : null}
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {game && (
            <Link href={`/dashboard/games/${game.path}?level=${attempt.level}`} className="btn-primary">
              Play {game.title} again
            </Link>
          )}
          <Link href="/dashboard/games" className="btn-ghost">
            Back to games
          </Link>
        </div>
      </div>
    </div>
  );
}
