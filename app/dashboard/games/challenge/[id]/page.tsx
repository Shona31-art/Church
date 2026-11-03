import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { getAvatarUrls } from "@/lib/avatars";
import { challengeState } from "@/lib/games/challenge";
import { announceIfClosed, challengeReview } from "../actions";
import { ChallengeRoom, type Entry } from "./ChallengeRoom";

/** One church challenge: play it, watch the live leaderboard, see the results. */
export default async function ChallengePage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const { data: challenge } = await supabase.from("church_challenges").select("*").eq("id", params.id).maybeSingle();
  if (!challenge) notFound();
  const closed = challengeState(challenge) === "closed";
  if (closed) await announceIfClosed(params.id);

  const [{ data: entries }, { data: host }, review] = await Promise.all([
    supabase.from("church_challenge_entries").select("user_id, score, ms, done, finished_at, app_users(name)").eq("challenge_id", params.id),
    challenge.created_by ? supabase.from("app_users").select("name").eq("id", challenge.created_by).maybeSingle() : Promise.resolve({ data: null }),
    closed ? challengeReview(params.id) : Promise.resolve(null),
  ]);
  const list = ((entries ?? []) as any[]).map((e) => ({ user_id: e.user_id, score: e.score, ms: e.ms, done: e.done, finished_at: e.finished_at, name: e.app_users?.name ?? "Member" })) as Entry[];
  const photos = await getAvatarUrls(list.map((e) => e.user_id));

  return (
    <ChallengeRoom
      challenge={challenge}
      hostName={host?.name ?? null}
      meId={me.id}
      meName={me.name}
      canClose={can(me.role, "manageQuizQuestions")}
      initialEntries={list.map((e) => ({ ...e, photoUrl: photos.get(e.user_id) ?? null }))}
      review={review}
    />
  );
}
