"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/chat";

/**
 * Tells the database "I'm here" about once a minute while the app is open and
 * on screen — that's what "online" and "last seen" in private chats come from
 * (chat_v4.sql). Hidden or closed app: nothing is sent. Does nothing for
 * people who've hidden their last seen (the database ignores it then).
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let last = 0;
    const beat = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < PRESENCE_HEARTBEAT_MS - 5000) return;
      last = Date.now();
      // A missing function (chat_v4.sql not run yet) is simply ignored.
      supabase.rpc("touch_presence").then(() => undefined);
    };
    beat();
    const timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
  return null;
}
