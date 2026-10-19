"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_ACCEPT, ATTACHMENT_BUCKET, attachmentPathFor, attachmentProblem } from "@/lib/support";
import { FieldError } from "@/components/ui/Alert";

// Uploads a screenshot straight to Supabase Storage (into the user's own
// folder — RLS requires it) and reports the storage *path*, not a URL. The
// server turns paths into short-lived signed links when showing a ticket.
export function FileUpload({ id, onUploaded }: { id: string; onUploaded: (path: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Free the local preview's memory when it's replaced or the form unmounts.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setPreview(null);
    onUploaded("");
    if (!file) return;

    const problem = attachmentProblem(file);
    if (problem) {
      setError(problem);
      e.target.value = "";
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      setError("Your session has expired — sign in again to attach a file.");
      return;
    }

    const path = attachmentPathFor(user.id, file.type, crypto.randomUUID());
    const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type });
    setUploading(false);

    if (uploadError) {
      console.error("[support] upload failed:", uploadError.message);
      setError("Couldn't upload that image — try again, or send your message without it.");
      e.target.value = "";
      return;
    }

    setPreview(URL.createObjectURL(file));
    onUploaded(path);
  }

  return (
    <div>
      <input id={id} type="file" accept={ATTACHMENT_ACCEPT} onChange={handleFile} disabled={uploading} className="text-sm" />
      <p className="text-xs text-ink/60 mt-1">PNG, JPEG, WebP or GIF, up to 5 MB.</p>
      {uploading && <p role="status" className="text-xs text-ink/60 mt-1">Uploading…</p>}
      <FieldError>{error}</FieldError>
      {preview && !uploading && (
        // Local blob preview — next/image can't optimise blob: URLs.
        <img src={preview} alt="Attachment preview" className="mt-2 max-h-32 rounded-lg border border-ink/10" />
      )}
    </div>
  );
}
