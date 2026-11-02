"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lastSeenLabel } from "@/lib/chat";

/**
 * Under the name in a private chat: "online" or "last seen today at 14:02"
 * (when both people share it — chat_v4.sql), otherwise the usual line.
 * Checks every 30 seconds while the chat is open.
 */
export function DmStatus({ channelId, fallback }: { channelId: string; fallback: string }) {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      supabase.rpc("dm_last_seen", { target_channel: channelId }).then(({ data, error }) => {
        if (alive && !error) setLastSeen((data as string | null) ?? null);
        if (alive) tick((n) => n + 1);
      });
    };
    load();
    const timer = setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [channelId]);

  if (!lastSeen) return <>{fallback}</>;
  const label = lastSeenLabel(lastSeen);
  return (
    <span className={label === "online" ? "font-medium text-success" : undefined}>
      {label}
    </span>
  );
}
