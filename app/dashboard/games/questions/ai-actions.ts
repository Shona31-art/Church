"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { z } from "zod";
import { generateJson, isAiConfigured } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";

const QuestionSchema = z.object({
  question: z.string().min(5).max(500),
  choices: z.array(z.string().min(1).max(200)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  category: z.enum(["old_testament", "new_testament", "people", "numbers", "general"]).catch("general"),
  difficulty: z.enum(["easy", "medium", "hard"]).catch("medium"),
});

export interface GeneratedQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export async function generateQuestionsWithAI(
  topic: string,
  count: number = 5
): Promise<{ questions: GeneratedQuestion[]; error?: string }> {
  if (!isAiConfigured()) {
    return { questions: [], error: "AI isn't configured (ANTHROPIC_API_KEY) — add questions manually instead." };
  }
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return { questions: [], error: "Only church admins and pastors can generate questions." };
  }
  const quota = await consumeAiQuota("quiz_generation");
  if (!quota.ok) return { questions: [], error: quota.error };
  const safeCount = Math.min(Math.max(Math.trunc(count) || 5, 1), 10);

  const parsed = await generateJson<unknown>({
    maxTokens: 3000,
    prompt: `Write ${safeCount} multiple-choice Bible trivia questions about "${topic.slice(0, 200) || "general Bible knowledge"}". Each needs exactly 4 answer choices with exactly one correct. Keep questions factual (people, places, events, numbers) — do not quote verse text verbatim, just ask about facts. Respond with ONLY a valid JSON array, no other text, in this exact shape: [{"question": "...", "choices": ["...", "...", "...", "..."], "correctIndex": 0, "category": "old_testament|new_testament|people|numbers|general", "difficulty": "easy|medium|hard"}]`,
  });

  // Validate every AI question before a human ever sees it for review —
  // malformed ones (wrong choice count, out-of-range answer) are dropped.
  const result = z.array(QuestionSchema).safeParse(parsed);
  if (!result.success) {
    const salvaged = Array.isArray(parsed)
      ? parsed.map((q) => QuestionSchema.safeParse(q)).filter((r) => r.success).map((r) => r.data!)
      : [];
    if (!salvaged.length) return { questions: [], error: "AI generation failed — try again or add manually." };
    return { questions: salvaged };
  }
  return { questions: result.data };
}

export async function saveGeneratedQuestions(
  input: GeneratedQuestion[]
): Promise<{ error?: string }> {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return { error: "Only church admins and pastors can add questions." };
  }
  // Server-side re-validation: the client could have edited these in transit.
  const parsed = z.array(QuestionSchema).min(1).max(20).safeParse(input);
  if (!parsed.success) return { error: "Some questions are incomplete — each needs 4 choices." };
  const questions = parsed.data;

  const supabase = createClient();
  const { error } = await supabase.from("bible_quiz_questions").insert(
    questions.map((q) => ({
      church_id: me.church_id,
      created_by: me.id,
      question: q.question,
      choices: q.choices,
      correct_index: q.correctIndex,
      category: q.category,
      difficulty: q.difficulty,
    }))
  );
  if (error) {
    console.error("[games] saving questions failed:", error.message);
    return { error: "Couldn't save the questions — try again." };
  }
  return {};
}
