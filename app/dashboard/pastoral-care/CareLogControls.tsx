"use client";

import { useFormState } from "react-dom";
import { deleteCareLog, setFollowUpDone } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";

export function FollowUpToggle({ id, done }: { id: string; done: boolean }) {
  const [state, action] = useFormState(setFollowUpDone, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <PendingButton className="btn-secondary btn-sm">{done ? "Reopen follow-up" : "Mark followed up"}</PendingButton>
      {state?.error && <p role="alert" className="text-xs text-danger mt-1">{state.error}</p>}
    </form>
  );
}

export function DeleteCareLog({ id, memberName }: { id: string; memberName: string }) {
  const [state, action] = useFormState(deleteCareLog, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton
        title="Delete this care record?"
        message={`The record for ${memberName} will be permanently deleted. The deletion is noted in the audit log (without the record's content). This can't be undone.`}
        confirmLabel="Delete record"
        pendingLabel="Deleting…"
        className="btn-ghost btn-sm text-danger"
      >
        Delete
      </ConfirmSubmitButton>
      {state?.error && <p role="alert" className="text-xs text-danger mt-1">{state.error}</p>}
    </form>
  );
}
