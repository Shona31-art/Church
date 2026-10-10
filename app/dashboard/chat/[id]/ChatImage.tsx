"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CHAT_MEDIA_BUCKET } from "@/lib/chat";

/**
 * A photo in a chat bubble. Photos are private: a short-lived signed link is
 * fetched when the bubble appears (Storage checks the viewer is in this chat).
 * Opens full size in a new tab.
 */
export function ChatImage({ path, caption }: { path: string; caption: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .storage.from(CHAT_MEDIA_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) setFailed(true);
        else setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) {
    return (
      <p className="flex items-center gap-1.5 text-xs italic opacity-70">
        <ImageOff aria-hidden className="h-3.5 w-3.5" /> Couldn&apos;t load this photo — refresh to try again.
      </p>
    );
  }

  return (
    <div className="-mx-1.5 -mt-0.5 mb-1">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl">
          {/* unoptimized: already compressed on upload; signed links expire. */}
          <Image src={url} alt={caption ? `Photo: ${caption}` : "Photo"} width={320} height={320} unoptimized className="max-h-80 w-auto max-w-full object-cover" />
        </a>
      ) : (
        <div className="h-48 w-64 animate-pulse rounded-xl bg-ink/10" role="img" aria-label="Loading photo" />
      )}
    </div>
  );
}
