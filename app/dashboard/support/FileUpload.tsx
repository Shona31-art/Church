"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FileUpload({
  onUploaded,
  currentUrl,
}: {
  onUploaded: (url: string) => void;
  currentUrl?: string;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(currentUrl || "");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);

    if (uploadError) {
      setError("Upload failed — check that the 'attachments' bucket exists (see README).");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    setUrl(data.publicUrl);
    onUploaded(data.publicUrl);
    setUploading(false);
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFile} className="text-sm" />
      {uploading && <p className="text-xs text-ink/40 mt-1">Uploading...</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {url && !uploading && (
        <img src={url} alt="Attachment preview" className="mt-2 max-h-32 rounded-lg border border-ink/10" />
      )}
    </div>
  );
}
