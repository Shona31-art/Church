import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DUEL_SECONDS } from "@/lib/games/duel";
import { ordinal, rankEntries } from "@/lib/games/challenge";

/**
 * A church challenge that has closed: tell everyone who played who won and
 * where they came — once (announced_at is claimed first, so two callers
 * can't both send). Anyone who didn't finish is ranked with the questions
 * they missed counting as wrong and taking the full time.
 */
export async function announceChallenge(challengeId: string): Promise<void> {
  const admin = createAdminClient(); // server only: the whole leaderboard and everyone's notifications
  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("church_challenges")
    .update({ announced_at: now })
    .eq("id", challengeId)
    .is("announced_at", null)
    .lte("ends_at", now)
    .select("id, church_id, title, questions");
  const challenge = claimed?.[0] as { id: string; church_id: string; title: string; questions: unknown[] } | undefined;
  if (!challenge) return;

  const total = challenge.questions.length;
  const { data: entries } = await admin.from("church_challenge_entries").select("user_id, score, ms, done, finished_at, app_users(name)").eq("challenge_id", challengeId);
  const list = ((entries ?? []) as any[]).map((e) => ({ ...e, ms: e.ms + (total - e.done) * DUEL_SECONDS * 1000, finished_at: e.finished_at ?? "closed" }));
  if (!list.length) return;
  const ranked = rankEntries(list);
  const winner = ranked[0];
  const winnerName = (winner as any).app_users?.name ?? "Someone";
  const rows = ranked.map((e) => ({
    user_id: e.user_id,
    church_id: challenge.church_id,
    category: "church_news",
    type: "game.challenge",
    title: `🏆 ${challenge.title}: the results`,
    body:
      e.rank === 1
        ? `You won with ${e.score}/${total}! Well done. ${ranked.length} played.`
        : `${winnerName} won with ${winner.score}/${total}. You came ${ordinal(e.rank ?? ranked.length)} of ${ranked.length} with ${e.score}/${total}.`,
    link: `/dashboard/games/challenge/${challengeId}`,
  }));
  const { error } = await admin.from("notifications").insert(rows);
  if (error) console.error("[challenge] results notifications failed:", error.message);
}

/** Nightly: any closed challenge nobody has opened since it closed gets its results sent. */
export async function announceDueChallenges(): Promise<number> {
  const { data, error } = await createAdminClient().from("church_challenges").select("id").is("announced_at", null).lte("ends_at", new Date().toISOString()).limit(50);
  if (error) return 0; // church_challenges.sql not run yet
  for (const c of data ?? []) await announceChallenge(c.id);
  return data?.length ?? 0;
}
