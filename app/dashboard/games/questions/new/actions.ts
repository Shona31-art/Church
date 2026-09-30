"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function createQuestion(formData: FormData) {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) return;

  const question = String(formData.get("question") || "").trim();
  const choices = [0, 1, 2, 3].map((i) => String(formData.get(`choice_${i}`) || "").trim());
  const correctIndex = parseInt(String(formData.get("correct_index") || "0"), 10);
  const category = String(formData.get("category") || "general");
  const difficulty = String(formData.get("difficulty") || "medium");

  if (!question || choices.some((c) => !c)) return;

  const supabase = createClient();
  await supabase.from("bible_quiz_questions").insert({
    church_id: me.church_id,
    created_by: me.id,
    question,
    choices,
    correct_index: correctIndex,
    category,
    difficulty,
  });

  redirect("/dashboard/games/questions");
}
