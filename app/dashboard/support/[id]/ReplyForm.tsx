"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { FileUpload } from "../FileUpload";
import { replyToTicket } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useFormState(replyToTicket, null);
  const [attachmentPath, setAttachmentPath] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box after a successful send; on error the text stays put.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setAttachmentPath("");
      setShowUpload(false);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2 mb-4">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label htmlFor="reply" className="sr-only">Your reply</label>
      <div className="flex gap-2 items-end">
        <textarea id="reply" name="content" required rows={2} maxLength={5000} placeholder="Write a reply…" className="input flex-1" />
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          aria-expanded={showUpload}
          aria-label="Attach a screenshot"
          title="Attach a screenshot"
          className="btn-secondary px-3"
        >
          📎
        </button>
        <PendingButton pendingLabel="Sending…">
          Send
        </PendingButton>
      </div>
      {showUpload && (
        <div>
          <label htmlFor="reply-attachment" className="sr-only">Screenshot</label>
          <FileUpload id="reply-attachment" onUploaded={setAttachmentPath} />
          <input type="hidden" name="attachment_path" value={attachmentPath} />
        </div>
      )}
      {state?.error && <p role="alert" className="text-sm text-danger">⚠ {state.error}</p>}
    </form>
  );
}
