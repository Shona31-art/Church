"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { flash } from "@/lib/flash";
import { can } from "@/lib/permissions";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";

// Matches the bible_quiz_questions check constraints, so a bad value gets a
// clear message here instead of a silent database rejection.
const QuestionSchema = z.object({
  question: z.string().trim().min(5, "Write the question.").max(300, "Keep the question under 300 characters."),
  choices: z.array(z.string().trim().min(1, "Fill in all four answers.").max(120, "Keep each answer under 120 characters.")).length(4),
  correctIndex: z.coerce.number().int().min(0).max(3, "Choose which answer is correct."),
  category: z.enum(["old_testament", "new_testament", "people", "numbers", "general"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

/** Form fields: question, choice_0..choice_3, correct_index, category, difficulty */
export async function createQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!can(me.role, "manageQuizQuestions")) return { error: "Only church admins and pastors can add questions." };
  if (!(await checkModuleAccess("bible_games")).allowed) return { error: "Bible games aren't available on your church's plan." };

  const parsed = QuestionSchema.safeParse({
    question: formData.get("question"),
    choices: [0, 1, 2, 3].map((i) => String(formData.get(`choice_${i}`) ?? "")),
    correctIndex: formData.get("correct_index"),
    category: formData.get("category"),
    difficulty: formData.get("difficulty"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the question.", values: formValues(formData) };
  if (new Set(parsed.data.choices.map((c) => c.toLowerCase())).size < 4) {
    return { error: "Each answer needs to be different.", values: formValues(formData) };
  }

  const { error } = await createClient().from("bible_quiz_questions").insert({
    church_id: me.church_id,
    created_by: me.id,
    question: parsed.data.question,
    choices: parsed.data.choices,
    correct_index: parsed.data.correctIndex,
    category: parsed.data.category,
    difficulty: parsed.data.difficulty,
  });
  if (error) {
    console.error("[games] question insert failed:", error.message);
    return { error: "Couldn't save the question — please try again.", values: formValues(formData) };
  }

  revalidatePath("/dashboard/games/questions");
  flash("Question added. Your members will see it in the quiz.");
  redirect("/dashboard/games/questions");
}

/** Form fields: id */
export async function deleteQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageQuizQuestions")) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "That question couldn't be found." };
  // church_id filter: the shared global pool can only be changed by platform admins.
  const { data: deleted, error } = await createClient().from("bible_quiz_questions").delete().eq("id", id.data).eq("church_id", me.church_id).select("id");
  if (error || !deleted?.length) return { error: "Couldn't delete that question — please try again." };
  revalidatePath("/dashboard/games/questions");
  flash("Question deleted.");
  return { ok: true };
}
