"use client";

import { useFormState } from "react-dom";
import { removeMemberPhoto } from "../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FieldError } from "@/components/ui/Alert";

/** Lets a pastor/admin take down an inappropriate profile photo (logged). */
export function RemovePhotoButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [state, action] = useFormState(removeMemberPhoto, null);
  return (
    <form action={action}>
      <input type="hidden" name="member_id" value={memberId} />
      <ConfirmSubmitButton
        title="Remove profile photo?"
        message={`${memberName}'s photo will be deleted and replaced with their initials. They can add a new one. This is recorded in the activity log.`}
        confirmLabel="Remove photo"
        className="btn-secondary"
        pendingLabel="Removing…"
      >
        Remove photo
      </ConfirmSubmitButton>
      <FieldError>{state?.error}</FieldError>
    </form>
  );
}
