"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { FileUpload } from "../FileUpload";
import { createTicket } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";

const field = "w-full border border-ink/20 rounded-lg px-4 py-3";

export default function NewTicketPage() {
  const [state, formAction] = useFormState(createTicket, null);
  const [attachmentPath, setAttachmentPath] = useState("");

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Link href="/dashboard/support" className="text-sm text-ink/50 hover:text-ink">← Support</Link>
      <h1 className="text-2xl font-semibold">New support ticket</h1>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          ⚠ {state.error}
        </p>
      )}

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

      <PendingButton pendingLabel="Submitting…" className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50">
        Submit ticket
      </PendingButton>
    </form>
  );
}
