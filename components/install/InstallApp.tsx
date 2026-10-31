"use client";

import { useState } from "react";
import { CircleCheck, Download, LoaderCircle } from "lucide-react";
import { useInstall } from "./install-store";
import { InAppBrowserSteps, IosSteps, ManualSteps } from "./InstallSteps";

/**
 * "Install the app" on My Account. Shows only what this device can actually
 * do (see the table in docs/plans/installable-app.md), and says "installed"
 * only when the browser confirms it.
 */
export function InstallApp() {
  const { mode, platform, justInstalled, installedOnDevice, promptInstall } = useInstall();
  const [waiting, setWaiting] = useState(false);
  const [declined, setDeclined] = useState(false);

  async function install() {
    setDeclined(false);
    const outcome = await promptInstall();
    if (outcome === "accepted") setWaiting(true); // confirmed by `appinstalled`, which flips mode/justInstalled
    if (outcome === "dismissed") setDeclined(true);
  }

  if (mode === null) return <div aria-hidden className="h-10" />;

  if (installedOnDevice && mode !== "installed" && !justInstalled) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink/80">
        <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
        Grace is installed on this phone. Open it from your home screen or app list.
      </p>
    );
  }

  if (mode === "installed" || justInstalled) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink/80">
        <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
        {mode === "installed" ? "You're using the installed app." : "Installed. Open Grace from your home screen or app list."}
      </p>
    );
  }

  // Accepted, but the browser hasn't confirmed yet. Say what's happening,
  // not that it's done (some browsers never send the confirmation).
  if (waiting) {
    return (
      <p role="status" className="flex items-start gap-2 text-sm text-ink/80">
        <LoaderCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin" />
        Installing — Grace should appear on your home screen or app list in a moment.
      </p>
    );
  }

  if (mode === "prompt") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/70">Add Grace to your home screen. It opens full screen, like any other app, and keeps you signed in.</p>
        <button type="button" onClick={install} className="btn-primary">
          <Download aria-hidden className="h-4 w-4" /> Install Grace
        </button>
        <p className="hint">
          If it says installation failed, open Chrome&apos;s menu ⋮ → <strong>Add to Home screen</strong> → <strong>Create shortcut</strong> instead.
        </p>
      </div>
    );
  }

  if (mode === "ios") return <IosSteps />;
  if (mode === "in-app") return <InAppBrowserSteps />;
  return (
    <div className="space-y-3">
      {declined && <p className="hint">You can still install from your browser&apos;s menu:</p>}
      <ManualSteps platform={platform} />
    </div>
  );
}
