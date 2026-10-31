"use client";

import { Copy, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import type { InstallPlatform } from "@/lib/install";
import { showToast } from "@/components/ui/Toaster";

/** iPhone/iPad: there's no install prompt, so walk through Safari's Share menu. */
export function IosSteps() {
  return (
    <ol className="space-y-3 text-sm">
      <Step n={1}>
        Tap the <strong>Share</strong> button <Share aria-hidden className="mx-0.5 inline h-4 w-4 -translate-y-px text-ink" /> — at the bottom of
        Safari on iPhone, at the top on iPad.
      </Step>
      <Step n={2}>
        Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus aria-hidden className="mx-0.5 inline h-4 w-4 -translate-y-px text-ink" />.
      </Step>
      <Step n={3}>
        Tap <strong>Add</strong>. Grace appears on your home screen and opens full screen.
      </Step>
      <p className="hint">Using Chrome or Edge on iPhone? The Share button is in the address bar; the steps are the same.</p>
    </ol>
  );
}

/** No prompt offered (e.g. Firefox, or the browser hasn't decided yet): use its menu. */
export function ManualSteps({ platform }: { platform: InstallPlatform | null }) {
  if (platform === "android") {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>
          Open your browser&apos;s menu <EllipsisVertical aria-hidden className="mx-0.5 inline h-4 w-4 -translate-y-px text-ink" /> (top right in Chrome).
        </Step>
        <Step n={2}>
          Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.
        </Step>
      </ol>
    );
  }
  return (
    <p className="text-sm text-ink/70">
      In Chrome or Edge, click the install icon at the right of the address bar, or open the browser menu and choose{" "}
      <strong>Install Grace</strong>. Other browsers may not support installing; the app works fully in the browser too.
    </p>
  );
}

/** WhatsApp, Facebook and similar open links in a mini-browser that can't install. */
export function InAppBrowserSteps() {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard`);
      showToast("Link copied. Paste it into Safari or Chrome.");
    } catch {
      showToast("Couldn't copy the link. Use your app's menu to open this page in your browser.", "error");
    }
  }
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink/70">
        You&apos;re viewing this inside another app, which can&apos;t install apps. Open this page in <strong>Safari</strong> (iPhone) or{" "}
        <strong>Chrome</strong> (Android) — usually via the <strong>⋯</strong> menu → <strong>Open in browser</strong> — then install from there.
      </p>
      <button type="button" onClick={copyLink} className="btn-secondary btn-sm">
        <Copy aria-hidden className="h-3.5 w-3.5" /> Copy link
      </button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-parchment text-xs font-semibold text-gold-deep">
        {n}
      </span>
      <span className="pt-0.5 text-ink/80">{children}</span>
    </li>
  );
}
