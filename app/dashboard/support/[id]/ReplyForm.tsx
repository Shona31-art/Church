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
      <label htmlFor="reply" className="block text-sm font-medium">Reply</label>
      <div className="flex gap-2">
        <input id="reply" name="content" required maxLength={5000} className="flex-1 border border-ink/20 rounded-lg px-4 py-2 text-sm" />
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          aria-expanded={showUpload}
          aria-label="Attach a screenshot"
          className="text-xs border border-ink/20 rounded-lg px-3"
        >
          📎
        </button>
        <PendingButton pendingLabel="Sending…" className="bg-ember text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
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
      {state?.error && <p role="alert" className="text-sm text-red-700">⚠ {state.error}</p>}
    </form>
  );
}
