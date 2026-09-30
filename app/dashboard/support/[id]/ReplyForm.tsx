"use client";

import { useState } from "react";
import { FileUpload } from "../FileUpload";
import { replyToTicket } from "./actions";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  return (
    <form action={replyToTicket.bind(null, ticketId)} className="space-y-2 mb-4">
      <div className="flex gap-2">
        <input
          name="content"
          placeholder="Type a reply..."
          required
          className="flex-1 border border-ink/20 rounded-lg px-4 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          className="text-xs border border-ink/20 rounded-lg px-3"
        >
          📎
        </button>
        <button type="submit" className="bg-ember text-white px-4 py-2 rounded-lg text-sm">
          Send
        </button>
      </div>
      {showUpload && (
        <div>
          <FileUpload onUploaded={setAttachmentUrl} />
          <input type="hidden" name="attachment_url" value={attachmentUrl} />
        </div>
      )}
    </form>
  );
}
