"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { FormActions, RequiredNote } from "@/components/ui/FormField";
import { useFormState } from "react-dom";
import { FileUpload } from "../FileUpload";
import { createTicket } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";

const field = "input";

export default function NewTicketPage() {
  const [state, formAction] = useFormState(createTicket, null);
  const [attachmentPath, setAttachmentPath] = useState("");

  return (
    <div>
    <div className="mb-6">
      <Link href="/dashboard/support" className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink mb-2"><span aria-hidden>←</span> Support</Link>
      <h1 className="text-2xl font-semibold">New support ticket</h1>
      <div className="rule-gold mt-2" />
      <p className="mt-2 text-sm text-ink/60">The platform team usually replies within one working day. Your church admin can see tickets from your church.</p>
    </div>
    <form action={formAction} className="card-elevated rounded-2xl p-5 sm:p-6 max-w-xl space-y-5">
      <RequiredNote />

      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <label htmlFor="subject" className="block text-sm font-medium mb-1">Subject</label>
        <input id="subject" name="subject" required minLength={3} maxLength={150} placeholder="e.g. Can't upload sermon audio" className={field} />
      </div>

      <div>
        <label htmlFor="priority" className="block text-sm font-medium mb-1">Priority</label>
        <select id="priority" name="priority" defaultValue="normal" className={field}>
          <option value="low">Low — whenever you can</option>
          <option value="normal">Normal</option>
          <option value="high">High — something important is broken</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">What happened?</label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={5000}
          placeholder="What were you trying to do, and what did you see instead?"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="attachment" className="block text-sm font-medium mb-1">
          Screenshot <span className="font-normal text-ink/40">(optional)</span>
        </label>
        <FileUpload id="attachment" onUploaded={setAttachmentPath} />
        <input type="hidden" name="attachment_path" value={attachmentPath} />
      </div>

      <FormActions>
        <PendingButton pendingLabel="Submitting…">Submit ticket</PendingButton>
        <Link href="/dashboard/support" className="btn-secondary">Cancel</Link>
      </FormActions>
    </form>
    </div>
  );
}
