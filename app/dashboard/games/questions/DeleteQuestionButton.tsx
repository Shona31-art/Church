"use client";

import { useFormState } from "react-dom";
import { deleteQuestion } from "./new/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function DeleteQuestionButton({ id, question }: { id: string; question: string }) {
  const [state, action] = useFormState(deleteQuestion, null);
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton
        title="Delete this question?"
        message={<>&ldquo;{question}&rdquo; will be removed from your church&apos;s quiz. Past scores aren&apos;t affected.</>}
        confirmLabel="Delete question"
        className="btn-ghost btn-sm text-danger"
        pendingLabel="Deleting…"
      >
        Delete<span className="sr-only"> question</span>
      </ConfirmSubmitButton>
      {state?.error && <p role="alert" className="text-xs text-danger mt-1">{state.error}</p>}
    </form>
  );
}
