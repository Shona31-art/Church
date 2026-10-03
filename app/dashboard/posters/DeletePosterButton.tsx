"use client";

import { useFormState } from "react-dom";
import { deletePoster } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";

export function DeletePosterButton({ id, title }: { id: string; title: string }) {
  const [state, action] = useFormState(deletePoster, null);
  return (
    <form action={action}>
      <input type="hidden" name="poster_id" value={id} />
      <ConfirmSubmitButton title={`Delete the “${title}” poster?`} message="The saved design will be removed. Images you already downloaded aren't affected." confirmLabel="Delete poster" pendingLabel="Deleting…">
        Delete
      </ConfirmSubmitButton>
      {state?.error && <Alert tone="error" className="mt-2">{state.error}</Alert>}
    </form>
  );
}
