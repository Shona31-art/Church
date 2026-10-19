"use client";

import { useFormState } from "react-dom";
import { deleteMyTransfer } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FieldError } from "@/components/ui/Alert";

/** Member: remove a transfer they recorded by mistake, while it's still waiting for confirmation. */
export function DeleteTransferButton({ giftId, summary }: { giftId: string; summary: string }) {
  const [state, action] = useFormState(deleteMyTransfer, null);
  return (
    <form action={action}>
      <input type="hidden" name="gift_id" value={giftId} />
      <ConfirmSubmitButton
        title="Remove this gift?"
        message={`${summary} will be removed from your history. Only do this if you recorded it by mistake — it doesn't affect any money you sent.`}
        confirmLabel="Remove"
        className="btn-ghost btn-sm text-danger hover:text-danger"
        pendingLabel="Removing…"
      >
        Remove
      </ConfirmSubmitButton>
      <FieldError>{state?.error}</FieldError>
    </form>
  );
}
