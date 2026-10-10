"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { GAMES, isGameKey, isLevel, pointsFor, type GameKey, type Level } from "@/lib/games/catalog";
import { newSeed } from "@/lib/games/random";
import { BADGES, currentStreak, dailyGame, dailySeed, earnedBadges, type BadgeKey } from "@/lib/games/progression";
import { isSetAnswerCorrect } from "@/lib/games/word-games";
import { localInputToUtcIso, todayInAppZone } from "@/lib/format";
import type { QuizKey, QuizProgress } from "@/lib/games/quiz";
import { VERSE_TRIES, isCorrectOrder, tokenize, type PuzzleVerse, type VerseProgress } from "@/lib/verse-puzzle";
import { ENGINES, type ReviewItem, type SetProgress, type SetPuzzle } from "./engine";

// Starting and finishing games. Server actions are public endpoints, so each
// one re-checks the session and plan, and every score is worked out here
// from the server's own copy of the puzzle — never taken from the browser.
//
// game_sessions has no RLS policies (members can't read the answers), so it's
// read and written with the service role, always scoped to the caller.

/** A game abandoned for longer than this can't be finished (keeps timing honest). */
const MAX_GAME_MS = 3 * 60 * 60 * 1000;
/** Generous cap on games started per person per hour — stops a script filling the table. */
const MAX_STARTS_PER_HOUR = 120;

export type GameMode = "practice" | "daily" | "kids";

export type StartResult =
  | { error: string }
  | { sessionId: string; game: GameKey; level: Level; timed: boolean; mode: GameMode; parSeconds: number; view: unknown };

export interface FinishResult {
  error?: string;
  correct?: number;
  maxCorrect?: number;
  points?: number;
  durationMs?: number;
  /** Answers to show after the game, for games that have them. */
  review?: ReviewItem[];
  /** Badges earned by this game. */
  newBadges?: { key: BadgeKey; title: string; description: string }[];
}

async function requirePlayer() {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return null;
  return (await checkModuleAccess("bible_games")).allowed ? me : null;
}

/** Start of today in the church's timezone, as a UTC instant. */
function startOfToday(): string {
  return localInputToUtcIso(`${todayInAppZone()}T00:00`) ?? new Date().toISOString();
}

/**
 * Input: game key, level, timed, mode. Creates the session and returns what
 * the player needs.
 *   practice — any game and level.
 *   kids     — Easy only, untimed, simpler content, kept off the scoreboard.
 *   daily    — today's game at Medium, timed, the same puzzle for everyone
 *              in the church, once per person per day.
 */
export async function startGame(game: string, level: string, timed: boolean, mode: GameMode = "practice"): Promise<StartResult> {
  const me = await requirePlayer();
  if (!me) return { error: "Your session has expired — sign in again to play." };
  if (!isGameKey(game) || !isLevel(level) || typeof timed !== "boolean" || !["practice", "daily", "kids"].includes(mode)) {
    return { error: "Choose a game and a level." };
  }
  if (mode === "kids") {
    level = "easy";
    timed = false;
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("game_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me.id)
    .gte("started_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= MAX_STARTS_PER_HOUR) return { error: "That's a lot of games! Take a short break and try again soon." };

  let seed = newSeed();
  if (mode === "daily") {
    const today = todayInAppZone();
    if (game !== dailyGame(today)) return { error: "Today's challenge has changed — go back to the games page." };
    level = "medium";
    timed = true;
    seed = dailySeed(me.church_id!, today);
    // One try per person per day: the puzzle is the same for everyone, so a
    // second go would let someone replay it knowing the answers.
    const { count: played } = await admin
      .from("game_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", me.id)
      .eq("mode", "daily")
      .gte("started_at", startOfToday());
    if ((played ?? 0) > 0) return { error: "You've already taken today's challenge. Come back tomorrow for a new one!" };
  }

  const built = await ENGINES[game].build(level as Level, seed, { supabase: createClient(), churchId: me.church_id!, kids: mode === "kids" });
  if ("error" in built) return { error: built.error };

  const { data, error } = await admin
    .from("game_sessions")
    .insert({ church_id: me.church_id, user_id: me.id, game_type: game, level, timed, mode, seed, puzzle: built.puzzle, max_correct: built.maxCorrect })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[games] start failed:", error?.message);
    return { error: error?.code === "42P01" ? "Games need a database update first — ask your church admin to contact support." : "Couldn't start the game — please try again." };
  }
  return { sessionId: data.id, game, level: level as Level, timed, mode, parSeconds: GAMES[game].parSeconds[level as Level], view: built.view };
}

async function loadOwnSession(sessionId: string, userId: string) {
  if (!z.string().uuid().safeParse(sessionId).success) return null;
  const { data } = await createAdminClient()
    .from("game_sessions")
    .select("id, church_id, user_id, game_type, level, mode, timed, puzzle, progress, started_at, finished_at, max_correct")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/**
 * Quiz: locks in the player's choice for one question and returns the
 * correct answer. The first choice for a question is the one that counts.
 */
export async function revealQuizAnswer(sessionId: string, questionIndex: number, choice: number): Promise<{ error?: string; correctIndex?: number; chosen?: number }> {
  const me = await requirePlayer();
  if (!me) return { error: "Your session has expired — sign in again." };
  const session = await loadOwnSession(sessionId, me.id);
  if (!session || session.game_type !== "quiz" || session.finished_at) return { error: "This game has ended — start a new one." };

  const key = session.puzzle as QuizKey;
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= key.ids.length) return { error: "That question isn't in this game." };
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return { error: "Choose one of the answers." };

  const progress = (session.progress ?? {}) as QuizProgress;
  const slot = String(questionIndex);
  if (progress[slot] === undefined) {
    progress[slot] = choice;
    const { error } = await createAdminClient().from("game_sessions").update({ progress }).eq("id", session.id).is("finished_at", null);
    if (error) {
      console.error("[games] saving quiz answer failed:", error.message);
      return { error: "Couldn't save your answer — check your connection." };
    }
  }
  return { correctIndex: key.correct[questionIndex], chosen: progress[slot] };
}

/**
 * Emoji stories, "Who said it?", fill in the verse: locks in one answer (a
 * choice index, or typed text) and says whether it was right. The first
 * answer to each question is the one that counts.
 */
export async function answerSetQuestion(
  sessionId: string,
  index: number,
  answer: number | string
): Promise<{ error?: string; correct?: boolean; answer?: string; reference?: string; answerIndex?: number }> {
  const me = await requirePlayer();
  if (!me) return { error: "Your session has expired — sign in again." };
  const session = await loadOwnSession(sessionId, me.id);
  if (!session || !["emoji", "who_said", "verse_fill"].includes(session.game_type) || session.finished_at) return { error: "This game has ended — start a new one." };

  const puzzle = session.puzzle as SetPuzzle;
  const question = puzzle.questions[index];
  if (!Number.isInteger(index) || !question) return { error: "That question isn't in this game." };
  if (typeof answer === "string" ? answer.length > 200 : !Number.isInteger(answer)) return { error: "That answer couldn't be read." };

  const progress = (session.progress ?? {}) as SetProgress;
  const slot = String(index);
  if (!progress[slot]) {
    progress[slot] = { answer, correct: isSetAnswerCorrect(question, answer, puzzle.exact) };
    const { error } = await createAdminClient().from("game_sessions").update({ progress }).eq("id", session.id).is("finished_at", null);
    if (error) return { error: "Couldn't save your answer — check your connection." };
  }
  return { correct: progress[slot].correct, answer: question.answer, reference: question.reference, answerIndex: question.answerIndex };
}

/**
 * Verse puzzle: checks one verse's order. Counts a try; a correct answer
 * scores unless the verse was revealed first.
 */
export async function checkVerseAttempt(sessionId: string, verseIndex: number, words: string[]): Promise<{ error?: string; correct?: boolean; triesLeft?: number }> {
  const me = await requirePlayer();
  if (!me) return { error: "Your session has expired — sign in again." };
  const session = await loadOwnSession(sessionId, me.id);
  if (!session || session.game_type !== "verse_puzzle" || session.finished_at) return { error: "This game has ended — start a new one." };
  const verses = (session.puzzle as { verses: PuzzleVerse[] }).verses;
  if (!Number.isInteger(verseIndex) || verseIndex < 0 || verseIndex >= verses.length) return { error: "That verse isn't in this game." };
  if (!Array.isArray(words) || words.length > 60 || !words.every((w) => typeof w === "string" && w.length <= 60)) return { error: "Those words couldn't be read." };

  const progress = (session.progress ?? {}) as VerseProgress;
  const slot = progress[String(verseIndex)] ?? { tries: 0 };
  if (slot.solved || slot.revealed) return { correct: Boolean(slot.solved), triesLeft: 0 };
  if (slot.tries >= VERSE_TRIES) return { error: "No tries left for this verse — reveal it to carry on.", triesLeft: 0 };

  const correct = isCorrectOrder(tokenize(verses[verseIndex].text), words);
  progress[String(verseIndex)] = { tries: slot.tries + 1, solved: correct || undefined };
  const { error } = await createAdminClient().from("game_sessions").update({ progress }).eq("id", session.id).is("finished_at", null);
  if (error) return { error: "Couldn't check that — check your connection." };
  return { correct, triesLeft: VERSE_TRIES - slot.tries - 1 };
}

/** Verse puzzle: shows the verse (no point for it). */
export async function revealVerse(sessionId: string, verseIndex: number): Promise<{ error?: string; text?: string }> {
  const me = await requirePlayer();
  if (!me) return { error: "Your session has expired — sign in again." };
  const session = await loadOwnSession(sessionId, me.id);
  if (!session || session.game_type !== "verse_puzzle" || session.finished_at) return { error: "This game has ended — start a new one." };
  const verses = (session.puzzle as { verses: PuzzleVerse[] }).verses;
  if (!Number.isInteger(verseIndex) || verseIndex < 0 || verseIndex >= verses.length) return { error: "That verse isn't in this game." };

  const progress = (session.progress ?? {}) as VerseProgress;
  const slot = progress[String(verseIndex)] ?? { tries: 0 };
  if (!slot.solved) {
    progress[String(verseIndex)] = { ...slot, revealed: true };
    await createAdminClient().from("game_sessions").update({ progress }).eq("id", session.id).is("finished_at", null);
  }
  return { text: verses[verseIndex].text };
}

/** Input: session id and the game's answers. Marks them, saves the score, returns the result. */
export async function finishGame(sessionId: string, answers: unknown): Promise<FinishResult> {
  const me = await requirePlayer();
  if (!me) return { error: "Your session has expired — sign in again. Your game wasn't saved." };
  const session = await loadOwnSession(sessionId, me.id);
  if (!session) return { error: "That game couldn't be found — start a new one." };
  if (session.finished_at) return { error: "This game was already finished." };

  const durationMs = Date.now() - new Date(session.started_at).getTime();
  if (durationMs > MAX_GAME_MS) return { error: "This game was started too long ago to count — start a new one." };

  const engine = ENGINES[session.game_type as GameKey];
  const parsed = engine.answers.safeParse(answers);
  if (!parsed.success) return { error: "Those answers couldn't be read — please try again." };

  const correct = Math.min(engine.check(session.puzzle, session.progress, parsed.data), session.max_correct);
  const level = session.level as Level;
  const points = pointsFor({
    correct,
    max: session.max_correct,
    level,
    timed: session.timed,
    durationMs,
    parSeconds: GAMES[session.game_type as GameKey].parSeconds[level],
  });

  const admin = createAdminClient();
  // `finished_at is null` makes a double-submit (two tabs, a retry) count once.
  const { data: closed, error } = await admin
    .from("game_sessions")
    .update({ finished_at: new Date().toISOString(), correct, points, duration_ms: durationMs })
    .eq("id", session.id)
    .is("finished_at", null)
    .select("id");
  if (error || !closed?.length) {
    if (error) console.error("[games] finish failed:", error.message);
    return { error: error ? "Couldn't save your score — please try again." : "This game was already finished." };
  }

  const { error: attemptError } = await admin.from("bible_quiz_attempts").insert({
    church_id: session.church_id,
    user_id: me.id,
    game_type: session.game_type,
    score: correct,
    total_questions: Math.max(1, session.max_correct),
    points,
    level,
    mode: session.mode,
    duration_ms: durationMs,
    session_id: session.id,
  });
  if (attemptError) console.error("[games] scoreboard insert failed:", attemptError.message);

  const newBadges = await awardBadges(me.id, session.church_id, {
    level,
    correct,
    max: session.max_correct,
    timed: session.timed,
    durationMs,
    parSeconds: GAMES[session.game_type as GameKey].parSeconds[level],
  });

  return { correct, maxCorrect: session.max_correct, points, durationMs, review: engine.review?.(session.puzzle, session.progress, parsed.data), newBadges };
}

/**
 * Works out which badges this player has now earned and records new ones.
 * Best-effort: a failure here never loses the score.
 */
async function awardBadges(
  userId: string,
  churchId: string,
  last: { level: string; correct: number; max: number; timed: boolean; durationMs: number; parSeconds: number }
): Promise<FinishResult["newBadges"]> {
  const admin = createAdminClient();
  const [{ data: history, error }, { data: owned }] = await Promise.all([
    admin.from("bible_quiz_attempts").select("game_type, mode, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5000),
    admin.from("user_badges").select("badge_key").eq("user_id", userId),
  ]);
  if (error || !history) return [];

  const days = history.map((a) => todayInAppZone(new Date(a.created_at)));
  const earned = earnedBadges({
    totalGames: history.length,
    gameTypes: new Set(history.map((a) => a.game_type)),
    crosswords: history.filter((a) => a.game_type === "crossword").length,
    dailyChallenges: history.filter((a) => a.mode === "daily").length,
    streak: currentStreak(days, todayInAppZone()),
    last,
  });
  const have = new Set((owned ?? []).map((b) => b.badge_key));
  const fresh = earned.filter((k) => !have.has(k));
  if (!fresh.length) return [];

  const { error: insertError } = await admin
    .from("user_badges")
    .upsert(fresh.map((badge_key) => ({ user_id: userId, church_id: churchId, badge_key })), { onConflict: "user_id,badge_key", ignoreDuplicates: true });
  if (insertError) {
    console.error("[games] awarding badges failed:", insertError.message);
    return [];
  }
  return fresh.map((key) => ({ key, ...BADGES[key] }));
}
