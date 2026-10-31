"use client";

import { Share2 } from "lucide-react";
import { shareContent, type ShareContent } from "@/lib/share";
import { showToast } from "@/components/ui/Toaster";
import { haptic } from "@/lib/haptics";

/** Opens the phone's share sheet (WhatsApp, Messages…), or copies the text where there isn't one. */
export function ShareButton({
  content,
  label = "Share",
  className = "btn-secondary",
  iconOnly = false,
}: {
  content: ShareContent | (() => Promise<ShareContent | null>);
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  async function onClick() {
    const resolved = typeof content === "function" ? await content() : content;
    if (!resolved) return;
    const result = await shareContent(resolved);
    if (result === "shared") haptic("success");
    if (result === "copied") showToast("Copied — paste it into WhatsApp or a message.", "success");
    if (result === "failed") showToast("Couldn't share on this device.", "error");
  }
  return (
    <button type="button" onClick={onClick} className={iconOnly ? `${className} btn-icon` : className} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}>
      <Share2 aria-hidden className="h-4 w-4" />
      {!iconOnly && label}
    </button>
  );
}
