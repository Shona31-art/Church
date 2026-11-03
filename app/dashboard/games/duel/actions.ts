"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { createRng, newSeed, shuffle } from "@/lib/games/random";
import { DUEL_LENGTHS, DUEL_SECONDS, duelWinner, otherSide, sideOf, timeAnswer, type DuelRow, type DuelSide } from "@/lib/games/duel";

// Bible Quiz Duels (supabase/game_duels.sql). Two people from the same
// church answer the same questions; the server keeps the answer key and
// every answer, checks each one as it's given, and decides the winner.

const MIGRATION_MISSING = "Bible duels need a database update first: run supabase/game_duels.sql.";
const Level = z.enum(["easy", "medium", "hard"]);

async function requirePlayer(): Promise<AppUser | { error: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  if (!(await checkModuleAccess("bible_games")).allowed) return { error: "Bible games aren't included in your church's plan." };
  return me;
}

/** The duel, if I'm one of its two players (RLS), plus which side I'm on. */
async function myDuel(duelId: string): Promise<{ me: AppUser; duel: DuelRow; side: DuelSide } | { error: string }> {
  const me = await requirePlayer();
  if ("error" in me) return me;
  if (!z.string().uuid().safeParse(duelId).success) return { error: "That duel couldn't be found." };
  const { data: duel } = await createClient().from("game_duels").select("*").eq("id", duelId).maybeSingle();
  const side = duel ? sideOf(duel as DuelRow, me.id) : null;
  if (!duel || !side) return { error: "That duel couldn't be found." };
  return { me, duel: duel as DuelRow, side };
}

/** People I can challenge: active members of my church (not me, not blocked either way). */
export async function duelCandidates(): Promise<{ people?: { id: string; name: string }[]; error?: string }> {
  const me = await requirePlayer();
  if ("error" in me) return { error: me.error };
  const admin = createAdminClient();
  const [{ data: users, error }, { data: blocks }] = await Promise.all([
    admin.from("app_users").select("id, name").eq("church_id", me.church_id!).eq("status", "active").neq("id", me.id).order("name").limit(1000),
    admin.from("chat_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${me.id},blocked_id.eq.${me.id}`),
  ]);
  if (error) return { error: "Couldn't load the church's members — try again." };
  const blocked = new Set(((blocks ?? []) as { blocker_id: string; blocked_id: string }[]).map((b) => (b.blocker_id === me.id ? b.blocked_id : b.blocker_id)));
  return { people: ((users ?? []) as { id: string; name: string }[]).filter((u) => !blocked.has(u.id)) };
}

/** Sends a challenge: picks the questions (same for both) and notifies the opponent. */
export async function createDuel(opponentId: string, level: string, length: number): Promise<{ duelId?: string; error?: string }> {
  const me = await requirePlayer();
  if ("error" in me) return { error: me.error };
  const opponent = z.string().uuid().safeParse(opponentId);
  const lvl = Level.safeParse(level);
  if (!opponent.success || opponent.data === me.id) return { error: "Choose who to challenge." };
  if (!lvl.success) return { error: "Choose a level." };
  if (!(DUEL_LENGTHS as readonly number[]).includes(length)) return { error: "Choose how many questions." };

  const admin = createAdminClient();
  const [{ data: them }, { data: block }, { count: open }] = await Promise.all([
    admin.from("app_users").select("id").eq("id", opponent.data).eq("church_id", me.church_id!).eq("status", "active").maybeSingle(),
    admin.from("chat_blocks").select("blocker_id").or(`and(blocker_id.eq.${me.id},blocked_id.eq.${opponent.data}),and(blocker_id.eq.${opponent.data},blocked_id.eq.${me.id})`).limit(1),
    admin.from("game_duels").select("id", { count: "exact", head: true }).eq("challenger_id", me.id).eq("status", "pending").gt("expires_at", new Date().toISOString()),
  ]);
  if (!them || block?.length) return { error: "You can't challenge this person." };
  if ((open ?? 0) >= 10) return { error: "You have 10 challenges waiting for an answer — wait for some replies first." };

  // The same questions for both: this level first, topped up from the others.
  const { data: bank, error: bankError } = await createClient()
    .from("bible_quiz_questions")
    .select("id, question, choices, correct_index, difficulty")
    .or(`church_id.is.null,church_id.eq.${me.church_id}`)
    .order("id");
  if (bankError || !bank?.length) return { error: "No quiz questions are available yet." };
  const rng = createRng(newSeed());
  const atLevel = shuffle(bank.filter((q) => q.difficulty === lvl.data), rng);
  const others = shuffle(bank.filter((q) => q.difficulty !== lvl.data), rng);
  const chosen = [...atLevel, ...others].slice(0, length);
  const shuffled = chosen.map((q) => {
    const choices = q.choices as string[];
    const order = shuffle(choices.map((_, i) => i), rng);
    return { question: q.question as string, choices: order.map((i) => choices[i]), correct: order.indexOf(q.correct_index as number) };
  });

  const { data: duel, error } = await admin
    .from("game_duels")
    .insert({ church_id: me.church_id, challenger_id: me.id, opponent_id: opponent.data, level: lvl.data, questions: shuffled.map(({ question, choices }) => ({ question, choices })) })
    .select("id")
    .single();
  if (error || !duel) {
    console.error("[duel] create failed:", error?.message);
    return { error: error?.code === "42P01" ? MIGRATION_MISSING : "Couldn't send the challenge — try again." };
  }
  const { error: keyError } = await admin.from("game_duel_keys").insert({ duel_id: duel.id, correct: shuffled.map((q) => q.correct) });
  if (keyError) {
    await admin.from("game_duels").delete().eq("id", duel.id);
    return { error: "Couldn't send the challenge — try again." };
  }
  revalidatePath("/dashboard/games/duel");
  return { duelId: duel.id };
}

/** The opponent accepts or declines. */
export async function respondToDuel(duelId: string, accept: boolean): Promise<{ ok?: true; error?: string }> {
  const ctx = await myDuel(duelId);
  if ("error" in ctx) return ctx;
  if (ctx.side !== "opponent" || ctx.duel.status !== "pending") return { ok: true };
  if (new Date(ctx.duel.expires_at).getTime() <= Date.now()) return { error: "This challenge has run out." };
  await createAdminClient().from("game_duels").update({ status: accept ? "active" : "declined" }).eq("id", duelId).eq("status", "pending");
  revalidatePath("/dashboard/games/duel");
  return { ok: true };
}

/** The challenger takes back a challenge nobody has played yet. */
export async function cancelDuel(duelId: string): Promise<{ ok?: true; error?: string }> {
  const ctx = await myDuel(duelId);
  if ("error" in ctx) return ctx;
  if (ctx.side !== "challenger" || ctx.duel.status !== "pending" || ctx.duel.challenger_started_at) return { error: "This duel can't be cancelled now." };
  await createAdminClient().from("game_duels").update({ status: "cancelled" }).eq("id", duelId).eq("status", "pending");
  revalidatePath("/dashboard/games/duel");
  return { ok: true };
}

/** Starts my clock (the first question appears). The challenger may play before the opponent accepts. */
export async function startDuel(duelId: string): Promise<{ ok?: true; error?: string }> {
  const ctx = await myDuel(duelId);
  if ("error" in ctx) return ctx;
  const { duel, side } = ctx;
  if (!["pending", "active"].includes(duel.status) || (side === "opponent" && duel.status !== "active")) return { error: "This duel isn't open to play." };
  if (new Date(duel.expires_at).getTime() <= Date.now()) return { error: "This duel has run out of time." };
  if (!duel[`${side}_started_at`]) {
    await createAdminClient().from("game_duels").update({ [`${side}_started_at`]: new Date().toISOString() }).eq("id", duelId).is(`${side}_started_at`, null);
  }
  return { ok: true };
}

/**
 * Locks in my answer to one question (choice -1 = ran out of time) and says
 * what the right answer was. Answers go in order; the first one counts.
 */
export async function answerDuel(duelId: string, index: number, choice: number): Promise<{ correctIndex?: number; correct?: boolean; finished?: boolean; error?: string }> {
  const ctx = await myDuel(duelId);
  if ("error" in ctx) return ctx;
  const { me, duel, side } = ctx;
  const total = duel.questions.length;
  if (!Number.isInteger(index) || index < 0 || index >= total || !Number.isInteger(choice) || choice < -1 || choice > 3) return { error: "That answer didn't look right." };
  if (!["pending", "active"].includes(duel.status) || !duel[`${side}_started_at`] || duel[`${side}_finished_at`]) return { error: "This duel isn't open to play." };
  if (index !== duel[`${side}_done`]) return { error: "Answer the questions in order." };

  const admin = createAdminClient();
  const [{ data: key }, { data: previous }] = await Promise.all([
    admin.from("game_duel_keys").select("correct").eq("duel_id", duelId).maybeSingle(),
    index > 0 ? admin.from("game_duel_answers").select("answered_at").eq("duel_id", duelId).eq("user_id", me.id).eq("idx", index - 1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!key) return { error: "This duel is missing its answers." };
  const correctIndex = (key.correct as number[])[index];
  // The question appeared when the previous one was answered (or when I started).
  const shownAt = new Date((previous as { answered_at?: string } | null)?.answered_at ?? duel[`${side}_started_at`]!);
  const { ms, inTime } = timeAnswer(shownAt, new Date());
  const correct = inTime && choice === correctIndex;

  const { error } = await admin.from("game_duel_answers").insert({ duel_id: duelId, user_id: me.id, idx: index, choice, correct, ms });
  if (error) {
    if (error.code === "23505") return { error: "You've already answered that one." };
    console.error("[duel] answer failed:", error.message);
    return { error: "Couldn't save your answer — check your connection." };
  }

  const done = index + 1;
  const patch: Record<string, unknown> = { [`${side}_done`]: done };
  if (done === total) {
    const { data: mine } = await admin.from("game_duel_answers").select("correct, ms").eq("duel_id", duelId).eq("user_id", me.id);
    patch[`${side}_finished_at`] = new Date().toISOString();
    patch[`${side}_score`] = (mine ?? []).filter((a) => a.correct).length;
    patch[`${side}_ms`] = (mine ?? []).reduce((sum, a) => sum + (a.ms as number), 0);
  }
  await admin.from("game_duels").update(patch).eq("id", duelId);
  if (done === total) await settle(duelId);
  return { correctIndex, correct, finished: done === total };
}

/**
 * Over when both have finished — or when time ran out: unanswered questions
 * count as wrong, and a challenge nobody played is simply cancelled.
 * Safe to call any time; does nothing until the duel is over.
 */
export async function settleDuel(duelId: string): Promise<void> {
  const ctx = await myDuel(duelId);
  if ("error" in ctx) return;
  await settle(duelId);
}

async function settle(duelId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("game_duels").select("*").eq("id", duelId).maybeSingle();
  const duel = data as DuelRow | null;
  if (!duel || !["pending", "active"].includes(duel.status)) return;
  const expired = new Date(duel.expires_at).getTime() <= Date.now();
  const bothDone = Boolean(duel.challenger_finished_at && duel.opponent_finished_at);
  if (!bothDone && !expired) return;

  if (!duel.challenger_started_at && !duel.opponent_started_at) {
    await admin.from("game_duels").update({ status: "cancelled" }).eq("id", duelId).in("status", ["pending", "active"]);
    return;
  }
  const { data: answers } = await admin.from("game_duel_answers").select("user_id, correct, ms").eq("duel_id", duelId);
  const tally = (userId: string) => {
    const list = ((answers ?? []) as { user_id: string; correct: boolean; ms: number }[]).filter((a) => a.user_id === userId);
    // Unanswered questions take the full time, so not finishing never helps.
    const missing = duel.questions.length - list.length;
    return { score: list.filter((a) => a.correct).length, ms: list.reduce((s, a) => s + a.ms, 0) + missing * DUEL_SECONDS * 1000 };
  };
  const a = tally(duel.challenger_id);
  const b = tally(duel.opponent_id);
  const result = duelWinner(a, b);
  await admin
    .from("game_duels")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      challenger_score: a.score,
      opponent_score: b.score,
      challenger_ms: a.ms,
      opponent_ms: b.ms,
      winner_id: result === "a" ? duel.challenger_id : result === "b" ? duel.opponent_id : null,
    })
    .eq("id", duelId)
    .in("status", ["pending", "active"]);
}

export interface DuelReviewItem {
  question: string;
  choices: string[];
  correct: number;
  mine: number | null;
  theirs: number | null;
}

/** After the duel: every question with the right answer and both players' picks. */
export async function duelReview(duelId: string): Promise<DuelReviewItem[] | null> {
  const ctx = await myDuel(duelId);
  if ("error" in ctx || ctx.duel.status !== "finished") return null;
  const admin = createAdminClient();
  const [{ data: key }, { data: answers }] = await Promise.all([
    admin.from("game_duel_keys").select("correct").eq("duel_id", duelId).maybeSingle(),
    admin.from("game_duel_answers").select("user_id, idx, choice").eq("duel_id", duelId),
  ]);
  const other = ctx.duel[`${otherSide(ctx.side)}_id`];
  const pick = (userId: string, i: number) => ((answers ?? []) as { user_id: string; idx: number; choice: number }[]).find((a) => a.user_id === userId && a.idx === i)?.choice ?? null;
  return ctx.duel.questions.map((q, i) => ({ question: q.question, choices: q.choices, correct: (key?.correct as number[] | undefined)?.[i] ?? -1, mine: pick(ctx.me.id, i), theirs: pick(other, i) }));
}
