"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { createQuestion } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";

export function ManualQuestionForm() {
  const [state, action] = useFormState(createQuestion, null);
  const v = state?.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Question" htmlFor="question" required>
        <textarea id="question" name="question" required rows={2} maxLength={300} defaultValue={v.question} className="input" />
      </FormField>
      <fieldset className="space-y-2">
        <legend className="label">Answers — select the correct one</legend>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <input
              type="radio"
              id={`correct_${i}`}
              name="correct_index"
              value={i}
              defaultChecked={(v.correct_index ?? "0") === String(i)}
              className="h-4 w-4"
              aria-label={`Answer ${i + 1} is correct`}
            />
            <label htmlFor={`choice_${i}`} className="sr-only">
              Answer {i + 1}
            </label>
            <input id={`choice_${i}`} name={`choice_${i}`} required maxLength={120} placeholder={`Answer ${i + 1}`} defaultValue={v[`choice_${i}`]} className="input flex-1" />
          </div>
        ))}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Category" htmlFor="category">
          <select id="category" name="category" defaultValue={v.category ?? "general"} className="input">
            <option value="old_testament">Old Testament</option>
            <option value="new_testament">New Testament</option>
            <option value="people">People</option>
            <option value="numbers">Numbers</option>
            <option value="general">General</option>
          </select>
        </FormField>
        <FormField label="Difficulty" htmlFor="difficulty">
          <select id="difficulty" name="difficulty" defaultValue={v.difficulty ?? "medium"} className="input">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </FormField>
      </div>
      <FormActions>
        <PendingButton>Save question</PendingButton>
        <Link href="/dashboard/games/questions" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
