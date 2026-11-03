import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createRng, newSeed, shuffle } from "@/lib/games/random";

export interface PickedQuestions {
  /** What players see: questions and shuffled choices, never the answers. */
  questions: { question: string; choices: string[] }[];
  /** The right choice for each question, same order (server only). */
  correct: number[];
}

/**
 * Questions for a duel or church challenge: this level first, topped up from
 * the others if the bank is thin; global bank plus the church's own questions.
 * Each question's choices are shuffled so the answer isn't always in the same place.
 */
export async function pickQuizQuestions(churchId: string, level: string, length: number): Promise<PickedQuestions | { error: string }> {
  const { data: bank, error } = await createClient()
    .from("bible_quiz_questions")
    .select("id, question, choices, correct_index, difficulty")
    .or(`church_id.is.null,church_id.eq.${churchId}`)
    .order("id");
  if (error || !bank?.length) return { error: "No quiz questions are available yet." };
  const rng = createRng(newSeed());
  const atLevel = shuffle(bank.filter((q) => q.difficulty === level), rng);
  const others = shuffle(bank.filter((q) => q.difficulty !== level), rng);
  const chosen = [...atLevel, ...others].slice(0, length);
  const shuffled = chosen.map((q) => {
    const choices = q.choices as string[];
    const order = shuffle(choices.map((_, i) => i), rng);
    return { question: q.question as string, choices: order.map((i) => choices[i]), correct: order.indexOf(q.correct_index as number) };
  });
  return { questions: shuffled.map(({ question, choices }) => ({ question, choices })), correct: shuffled.map((q) => q.correct) };
}
