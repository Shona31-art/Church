"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { addPrayerComment } from "../actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { FieldError } from "@/components/ui/Alert";

export function CommentForm({ prayerId }: { prayerId: string }) {
  const [state, formAction] = useFormState(addPrayerComment, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box after a successful post (keep the text if it failed).
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3">
      <input type="hidden" name="prayer_id" value={prayerId} />
      <div className="flex gap-2">
        <label htmlFor={`c-${prayerId}`} className="sr-only">
          Leave a word of encouragement
        </label>
        <input
          id={`c-${prayerId}`}
          name="body"
          maxLength={1000}
          required
          placeholder="Leave a word of encouragement…"
          className="flex-1 min-w-0 border border-ink/20 rounded-lg px-3 py-2 text-sm"
        />
        <PendingButton className="btn-primary btn-sm" pendingLabel="…">
          Post
        </PendingButton>
      </div>
      <FieldError>{state?.error}</FieldError>
    </form>
  );
}
