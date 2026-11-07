"use client";

import { ManualQuestionForm } from "./ManualQuestionForm";
import { PageHeader } from "@/components/ui/PageHeader";

/** Add a quiz question by hand (the games already have a large built-in question bank). */
export function NewQuestionsForm() {
  return (
    <div className="max-w-lg">
      <PageHeader title="Add questions" back={{ href: "/dashboard/games/questions", label: "Quiz questions" }} />
      <ManualQuestionForm />
    </div>
  );
}
