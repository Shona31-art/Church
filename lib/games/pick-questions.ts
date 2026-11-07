import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRng, freshFirst, newSeed, shuffle } from "@/lib/games/random";

export interface PickedQuestions {
  /** What players see: questions and shuffled choices, never the answers. */
  questions: { question: string; choices: string[] }[];
  /** The right choice for each question, same order (server only). */
  correct: number[];
}

/**
 * Questions for a duel or church challenge: this level first, topped up from
 * the others if the bank is thin; global bank plus the church's own questions.
 * Questions the players have had before — in their quizzes and duels, and in
 * the church's earlier challenges — go to the back, so they only come round
 * again once the bank has been used up (oldest first).
 * Each question's choices are shuffled so the answer isn't always in the same place.
 */
export async function pickQuizQuestions(churchId: string, level: string, length: number, players: string[] = []): Promise<PickedQuestions | { error: string }> {
  const { data: bank, error } = await createClient()
    .from("bible_quiz_questions")
    .select("id, question, choices, correct_index, difficulty")
    .or(`church_id.is.null,church_id.eq.${churchId}`)
    .order("id");
  if (error || !bank?.length) return { error: "No quiz questions are available yet." };
  const seen = await seenQuestions(churchId, players, bank as { id: string | number; question: string }[]);
  const rng = createRng(newSeed());
  const key = (q: { question: string }) => q.question;
  const atLevel = freshFirst(bank.filter((q) => q.difficulty === level), rng, key, seen);
  const others = freshFirst(bank.filter((q) => q.difficulty !== level), rng, key, seen);
  const chosen = [...atLevel, ...others].slice(0, length);
  const shuffled = chosen.map((q) => {
    const choices = q.choices as string[];
    const order = shuffle(choices.map((_, i) => i), rng);
    return { question: q.question as string, choices: order.map((i) => choices[i]), correct: order.indexOf(q.correct_index as number) };
  });
  return { questions: shuffled.map(({ question, choices }) => ({ question, choices })), correct: shuffled.map((q) => q.correct) };
}

/** Question text → when last had (ms), from the players' quizzes and duels and the church's challenges. */
async function seenQuestions(churchId: string, players: string[], bank: { id: string | number; question: string }[]): Promise<Map<string, number>> {
  const seen = new Map<string, number>();
  const mark = (text: string | undefined, at: string) => {
    if (!text) return;
    const t = new Date(at).getTime();
    if (!(seen.get(text)! >= t)) seen.set(text, t);
  };
  const admin = createAdminClient();
  const byId = new Map(bank.map((q) => [String(q.id), q.question]));
  const ors = players.flatMap((id) => [`challenger_id.eq.${id}`, `opponent_id.eq.${id}`]).join(",");
  const [{ data: quizzes }, { data: duels }, { data: challenges }] = await Promise.all([
    players.length ? admin.from("game_sessions").select("puzzle, started_at").eq("game_type", "quiz").in("user_id", players).order("started_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    players.length ? admin.from("game_duels").select("questions, created_at").or(ors).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    admin.from("church_challenges").select("questions, created_at").eq("church_id", churchId).order("created_at", { ascending: false }).limit(100),
  ]);
  for (const s of (quizzes ?? []) as { puzzle: { ids?: unknown[] } | null; started_at: string }[]) for (const id of s.puzzle?.ids ?? []) mark(byId.get(String(id)), s.started_at);
  for (const d of (duels ?? []) as { questions: { question?: string }[] | null; created_at: string }[]) for (const q of d.questions ?? []) mark(q.question, d.created_at);
  for (const c of (challenges ?? []) as { questions: { question?: string }[] | null; created_at: string }[]) for (const q of c.questions ?? []) mark(q.question, c.created_at);
  return seen;
}
