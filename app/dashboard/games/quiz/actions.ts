"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
}

export async function getQuizQuestions(count: number = 10): Promise<QuizQuestion[]> {
  const me = await getCurrentAppUser();
  const supabase = createClient();

  // Global pool (church_id null) + this church's own custom/AI-generated
  // questions — RLS already scopes this correctly, but the explicit .or()
  // keeps the query efficient rather than relying purely on policy filtering.
  let query = supabase.from("bible_quiz_questions").select("id, question, choices");
  query = me?.church_id
    ? query.or(`church_id.is.null,church_id.eq.${me.church_id}`)
    : query.is("church_id", null);

  const { data } = await query;
  if (!data) return [];

  // Shuffle and take `count` — small question bank, fine to do in memory
  // rather than a database-level random() function.
  const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, count);

  // Strip correct_index — it was never selected, but be explicit that the
  // client never receives it. Answers are verified in checkAnswer() instead.
  return shuffled.map((q) => ({ id: q.id, question: q.question, choices: q.choices as string[] }));
}

export async function checkAnswer(
  questionId: string,
  choiceIndex: number
): Promise<{ correct: boolean; correctIndex: number }> {
  const supabase = createClient();
  const { data } = await supabase
    .from("bible_quiz_questions")
    .select("correct_index")
    .eq("id", questionId)
    .single();

  if (!data) return { correct: false, correctIndex: -1 };
  return { correct: data.correct_index === choiceIndex, correctIndex: data.correct_index };
}

export type GameType = "quiz" | "word_search" | "verse_puzzle";

// Upper bound on points per game — keeps a tampered client from posting an
// absurd score to the church scoreboard (points are submitted client-side).
const MAX_POINTS: Record<GameType, number> = { quiz: 20, word_search: 20, verse_puzzle: 10 };

export async function submitQuizAttempt(
  score: number,
  totalQuestions: number,
  gameType: GameType = "quiz"
): Promise<{ error?: string }> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again to save your score." };

  const max = MAX_POINTS[gameType];
  if (
    max === undefined ||
    !Number.isInteger(score) || !Number.isInteger(totalQuestions) ||
    totalQuestions < 1 || totalQuestions > max || score < 0 || score > totalQuestions
  ) {
    return { error: "That score couldn't be recorded." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("bible_quiz_attempts").insert({
    church_id: me.church_id,
    user_id: me.id,
    score,
    total_questions: totalQuestions,
    game_type: gameType,
  });
  if (error) {
    console.error("[games] saving attempt failed:", error.message);
    return { error: "Couldn't save your score — check your connection and try again." };
  }
  return {};
}
