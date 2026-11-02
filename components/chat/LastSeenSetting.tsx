"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/Toaster";

/** My account → Chat privacy: share "online" and "last seen" in private chats (chat_v4.sql). */
export function LastSeenSetting({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    const { error } = await createClient().rpc("set_last_seen_visibility", { visible: next });
    setBusy(false);
    if (error) {
      setOn(!next);
      showToast("Couldn't save that setting. Try again.", "error");
    }
  }

  return (
    <div className="mt-5 flex items-start justify-between gap-4 border-t border-line pt-5">
      <div>
        <label htmlFor="show-last-seen" className="font-medium">
          Show when I&apos;m online and last seen
        </label>
        <p className="text-sm text-ink/60">In private chats, the other person sees &ldquo;online&rdquo; or &ldquo;last seen today at 14:02&rdquo;. If you turn this off, you won&apos;t see theirs either.</p>
      </div>
      <button
        id="show-last-seen"
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ember" : "bg-ink/20"}`}
      >
        <span className="sr-only">{on ? "On" : "Off"}</span>
        <span aria-hidden className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-xs transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
