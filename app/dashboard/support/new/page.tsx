"use client";

import { useState } from "react";
import { FileUpload } from "../FileUpload";
import { createTicket } from "./actions";

export default function NewTicketPage() {
  const [attachmentUrl, setAttachmentUrl] = useState("");

  return (
    <form action={createTicket} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold mb-4">New support ticket</h1>

      <input
        name="subject"
        placeholder="What's the issue?"
        required
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <select name="priority" defaultValue="normal" className="w-full border border-ink/20 rounded-lg px-4 py-3">
        <option value="low">Low priority</option>
        <option value="normal">Normal priority</option>
        <option value="high">High priority</option>
      </select>
      <textarea
        name="message"
        placeholder="Describe the issue in detail..."
        required
        rows={6}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />

      <div>
        <label className="text-xs text-ink/40 block mb-1">Screenshot (optional)</label>
        <FileUpload onUploaded={setAttachmentUrl} />
        <input type="hidden" name="attachment_url" value={attachmentUrl} />
      </div>

      <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
        Submit ticket
      </button>
    </form>
  );
}
