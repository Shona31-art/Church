"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { DUEL_LENGTHS, timeAnswer } from "@/lib/games/duel";
import { CHALLENGE_DURATIONS, challengeState } from "@/lib/games/challenge";
import { pickQuizQuestions } from "@/lib/games/pick-questions";
import { announceChallenge } from "@/lib/games/challenge-server";

// Whole-church Bible challenges (supabase/church_challenges.sql). A pastor
// or church admin starts one; everyone plays the same questions once; the
// server keeps the answer key, checks and times every answer, and keeps the
// leaderboard.

const MIGRATION_MISSING = "Church challenges need a database update first: run supabase/church_challenges.sql.";

async function requirePlayer(): Promise<AppUser | { error: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  if (!(await checkModuleAccess("bible_games")).allowed) return { error: "Bible games aren't included in your church's plan." };
  return me;
}

type Challenge = { id: string; church_id: string; title: string; level: string; questions: { question: string; choices: string[] }[]; starts_at: string; ends_at: string; announced_at: string | null; created_by: string | null };

/** The challenge, if it's my church's (RLS). */
async function loadChallenge(id: string): Promise<{ me: AppUser; challenge: Challenge } | { error: string }> {
  const me = await requirePlayer();
  if ("error" in me) return me;
  if (!z.string().uuid().safeParse(id).success) return { error: "That challenge couldn't be found." };
  const { data } = await createClient().from("church_challenges").select("*").eq("id", id).maybeSingle();
  if (!data) return { error: "That challenge couldn't be found." };
  return { me, challenge: data as Challenge };
}

const NewChallenge = z.object({
  title: z.string().trim().min(1, "Give the challenge a name.").max(80, "Keep the name under 80 characters."),
  level: z.enum(["easy", "medium", "hard"]),
  length: z.number().refine((n) => (DUEL_LENGTHS as readonly number[]).includes(n), "Choose how many questions."),
  hours: z.number().refine((n) => CHALLENGE_DURATIONS.some((d) => d.hours === n), "Choose how long it's open."),
});

/** Pastors and church admins: start a challenge for the whole church (everyone is notified). */
export async function createChallenge(input: { title: string; level: string; length: number; hours: number }): Promise<{ id?: string; error?: string }> {
  const me = await requirePlayer();
  if ("error" in me) return { error: me.error };
  if (!can(me.role, "manageQuizQuestions")) return { error: "Only pastors and church admins can start a church challenge." };
  const parsed = NewChallenge.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const admin = createAdminClient();
  const { count: open, error: countError } = await admin
    .from("church_challenges")
    .select("id", { count: "exact", head: true })
    .eq("church_id", me.church_id!)
    .gt("ends_at", new Date().toISOString());
  if (countError) return { error: countError.code === "42P01" ? MIGRATION_MISSING : "Couldn't start the challenge — try again." };
  if ((open ?? 0) >= 3) return { error: "Three challenges are already running — let one finish first." };

  const picked = await pickQuizQuestions(me.church_id!, parsed.data.level, parsed.data.length);
  if ("error" in picked) return picked;
  const { data: created, error } = await admin
    .from("church_challenges")
    .insert({
      church_id: me.church_id,
      created_by: me.id,
      title: parsed.data.title,
      level: parsed.data.level,
      questions: picked.questions,
      ends_at: new Date(Date.now() + parsed.data.hours * 3_600_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[challenge] create failed:", error?.message);
    return { error: "Couldn't start the challenge — try again." };
  }
  const { error: keyError } = await admin.from("church_challenge_keys").insert({ challenge_id: created.id, correct: picked.correct });
  if (keyError) {
    await admin.from("church_challenges").delete().eq("id", created.id);
    return { error: "Couldn't start the challenge — try again." };
  }
  await logAudit({ churchId: me.church_id!, actorId: me.id, action: "game.challenge_started", targetTable: "church_challenges", targetId: created.id, metadata: { questions: parsed.data.length, hours: parsed.data.hours } });
  revalidatePath("/dashboard/games/challenge");
  return { id: created.id };
}

/** Pastors and church admins: close a challenge early (results go out straight away). */
export async function closeChallenge(id: string): Promise<{ ok?: true; error?: string }> {
  const ctx = await loadChallenge(id);
  if ("error" in ctx) return ctx;
  if (!can(ctx.me.role, "manageQuizQuestions")) return { error: "Only pastors and church admins can close a challenge." };
  if (challengeState(ctx.challenge) === "closed") return { ok: true };
  await createAdminClient().from("church_challenges").update({ ends_at: new Date().toISOString() }).eq("id", id);
  await announceChallenge(id);
  revalidatePath(`/dashboard/games/challenge/${id}`);
  return { ok: true };
}

/** Starts my clock: the first question appears. Once per person. */
export async function startChallenge(id: string): Promise<{ ok?: true; error?: string }> {
  const ctx = await loadChallenge(id);
  if ("error" in ctx) return ctx;
  if (challengeState(ctx.challenge) !== "open") return { error: "This challenge isn't open." };
  const { error } = await createAdminClient()
    .from("church_challenge_entries")
    .upsert({ challenge_id: id, user_id: ctx.me.id, church_id: ctx.me.church_id }, { onConflict: "challenge_id,user_id", ignoreDuplicates: true });
  if (error) return { error: "Couldn't start — try again." };
  return { ok: true };
}

/** Locks in my answer to one question (choice -1 = ran out of time). In order; the first answer counts. */
export async function answerChallenge(id: string, index: number, choice: number): Promise<{ correctIndex?: number; correct?: boolean; finished?: boolean; error?: string }> {
  const ctx = await loadChallenge(id);
  if ("error" in ctx) return ctx;
  const { me, challenge } = ctx;
  const total = challenge.questions.length;
  if (!Number.isInteger(index) || index < 0 || index >= total || !Number.isInteger(choice) || choice < -1 || choice > 3) return { error: "That answer didn't look right." };
  if (challengeState(challenge) !== "open") return { error: "This challenge has closed." };

  const admin = createAdminClient();
  const [{ data: entry }, { data: key }, { data: previous }] = await Promise.all([
    admin.from("church_challenge_entries").select("*").eq("challenge_id", id).eq("user_id", me.id).maybeSingle(),
    admin.from("church_challenge_keys").select("correct").eq("challenge_id", id).maybeSingle(),
    index > 0 ? admin.from("church_challenge_answers").select("answered_at").eq("challenge_id", id).eq("user_id", me.id).eq("idx", index - 1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!entry || entry.finished_at) return { error: "You've already played this challenge." };
  if (index !== entry.done) return { error: "Answer the questions in order." };
  if (!key) return { error: "This challenge is missing its answers." };

  const correctIndex = (key.correct as number[])[index];
  const shownAt = new Date((previous as { answered_at?: string } | null)?.answered_at ?? entry.started_at);
  const { ms, inTime } = timeAnswer(shownAt, new Date());
  const correct = inTime && choice === correctIndex;
  const { error } = await admin.from("church_challenge_answers").insert({ challenge_id: id, user_id: me.id, idx: index, choice, correct, ms });
  if (error) return { error: error.code === "23505" ? "You've already answered that one." : "Couldn't save your answer — check your connection." };

  const finished = index + 1 === total;
  await admin
    .from("church_challenge_entries")
    .update({ done: index + 1, score: entry.score + (correct ? 1 : 0), ms: entry.ms + ms, ...(finished ? { finished_at: new Date().toISOString() } : {}) })
    .eq("challenge_id", id)
    .eq("user_id", me.id)
    .eq("done", index);
  return { correctIndex, correct, finished };
}

/** Sends the results if the challenge has closed and they haven't gone out yet. */
export async function announceIfClosed(id: string): Promise<void> {
  const ctx = await loadChallenge(id);
  if ("error" in ctx || ctx.challenge.announced_at || challengeState(ctx.challenge) !== "closed") return;
  await announceChallenge(id);
}

export interface ChallengeReviewItem {
  question: string;
  choices: string[];
  correct: number;
  mine: number | null;
}

/** After it closes: every question, the right answer, and what I picked. */
export async function challengeReview(id: string): Promise<ChallengeReviewItem[] | null> {
  const ctx = await loadChallenge(id);
  if ("error" in ctx || challengeState(ctx.challenge) !== "closed") return null;
  const admin = createAdminClient();
  const [{ data: key }, { data: answers }] = await Promise.all([
    admin.from("church_challenge_keys").select("correct").eq("challenge_id", id).maybeSingle(),
    admin.from("church_challenge_answers").select("idx, choice").eq("challenge_id", id).eq("user_id", ctx.me.id),
  ]);
  return ctx.challenge.questions.map((q, i) => ({
    question: q.question,
    choices: q.choices,
    correct: (key?.correct as number[] | undefined)?.[i] ?? -1,
    mine: ((answers ?? []) as { idx: number; choice: number }[]).find((a) => a.idx === i)?.choice ?? null,
  }));
}
