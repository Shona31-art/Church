"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { devicePushState, enablePushOnDevice } from "@/lib/push-client";
import { showToast } from "@/components/ui/Toaster";
import { haptic } from "@/lib/haptics";

const DISMISS_KEY = "push-prompt-dismissed";

/**
 * Offers phone pop-ups at a moment they obviously help — e.g. right after
 * someone shares a prayer request ("know when people pray for you") —
 * instead of a cold browser permission popup. Shown only when this device
 * could turn pop-ups on and hasn't, and never again once dismissed.
 */
export function PushPrompt({ title, body }: { title: string; body: string }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    devicePushState().then((state) => setVisible(state === "off"));
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const result = await enablePushOnDevice();
      if (result.state === "on") {
        haptic("success");
        showToast("Notifications are on for this device.");
        setVisible(false);
      } else if (result.state === "blocked") {
        showToast("Notifications are blocked in your browser settings. You can allow them there later.", "info");
        dismiss();
      } else if (result.error) showToast(result.error, "error");
    } catch {
      showToast("Couldn't turn on notifications. You can try again in My account.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <aside aria-label="Turn on notifications" className="card-elevated relative flex items-start gap-4 rounded-2xl border-gold/40 p-5 motion-safe:animate-fade-in">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold-deep">
        <BellRing className="h-5 w-5" strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-ink/70">{body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={enable} disabled={busy}>
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
      <button type="button" onClick={dismiss} className="btn-ghost btn-icon absolute right-2 top-2 h-8 w-8" aria-label="Close">
        <X aria-hidden className="h-4 w-4" />
      </button>
    </aside>
  );
}
