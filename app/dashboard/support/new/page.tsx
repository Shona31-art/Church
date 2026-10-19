"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { useFormState } from "react-dom";
import { FileUpload } from "../FileUpload";
import { createTicket } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";

export default function NewTicketPage() {
  const [state, formAction] = useFormState(createTicket, null);
  const [attachmentPath, setAttachmentPath] = useState("");

  return (
    <div>
      <PageHeader
        title="New support ticket"
        back={{ href: "/dashboard/support", label: "Support" }}
        description="The platform team usually replies within one working day. Your church admin can see tickets from your church."
      />
      <form action={formAction} className="card-elevated max-w-xl space-y-5 rounded-2xl p-5 sm:p-6">
        <RequiredNote />

        {state?.error && <Alert tone="error">{state.error}</Alert>}

        <FormField label="Subject" htmlFor="subject" required>
          <input id="subject" name="subject" required minLength={3} maxLength={150} placeholder="e.g. Can't upload sermon audio" className="input" />
        </FormField>

        <FormField label="Priority" htmlFor="priority">
          <select id="priority" name="priority" defaultValue="normal" className="input">
            <option value="low">Low — whenever you can</option>
            <option value="normal">Normal</option>
            <option value="high">High — something important is broken</option>
          </select>
        </FormField>

        <FormField label="What happened?" htmlFor="message" required>
          <textarea
            id="message"
            name="message"
            required
            rows={6}
            maxLength={5000}
            placeholder="What were you trying to do, and what did you see instead?"
            className="input"
          />
        </FormField>

        <FormField label="Screenshot" htmlFor="attachment" optional>
          <FileUpload id="attachment" onUploaded={setAttachmentPath} />
          <input type="hidden" name="attachment_path" value={attachmentPath} />
        </FormField>

        <FormActions>
          <PendingButton pendingLabel="Submitting…">Submit ticket</PendingButton>
          <Link href="/dashboard/support" className="btn-secondary">
            Cancel
          </Link>
        </FormActions>
      </form>
    </div>
  );
}
