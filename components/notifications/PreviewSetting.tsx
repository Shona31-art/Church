"use client";

import { useState } from "react";
import { showToast } from "@/components/ui/Toaster";
import { setShowMessagePreviews } from "@/app/dashboard/account/notification-actions";

/** "Show message text": WhatsApp-style previews in message notifications, or just "Sent you a message". */
export function PreviewSetting({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    const res = await setShowMessagePreviews(next).catch(() => ({ ok: false as const, error: "Couldn't save that setting. Try again." }));
    setBusy(false);
    if (!res.ok) {
      setOn(!next);
      showToast(res.error, "error");
    }
  }

  return (
    <div className="mt-5 flex items-start justify-between gap-4 border-t border-line pt-5">
      <div>
        <label htmlFor="show-previews" className="font-medium">
          Show message text
        </label>
        <p className="text-sm text-ink/60">
          Message notifications show what was said, like WhatsApp. Turn off if others can see your phone&apos;s lock screen — they&apos;ll just say &ldquo;Sent you a message&rdquo;.
        </p>
      </div>
      <button
        id="show-previews"
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
