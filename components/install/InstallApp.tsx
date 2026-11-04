"use client";

import { useState } from "react";
import { CircleCheck, Download, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useInstall } from "./install-store";
import { ANDROID_APK_URL, graceAndroid } from "@/lib/android";
import { AndroidUpdate } from "./AndroidUpdate";
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

  // Inside the Android app: its version, and "Update available" when there's a newer one.
  if (graceAndroid()) return <AndroidUpdate />;

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

  if (mode === "android-app") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/70">Get Grace&apos;s Android app: calls ring like a phone call — even when Grace is closed or your phone is locked — and the app icon shows your unread count.</p>
        <a href={ANDROID_APK_URL} className="btn-primary" download>
          <Download aria-hidden className="h-4 w-4" /> Download the Android app
        </a>
        <p className="hint">
          Open <strong>grace.apk</strong> when it has downloaded and tap <strong>Install</strong> (allow installs from Chrome if asked).{" "}
          <Link href="/android" className="link">
            Step-by-step help
          </Link>
          . Already have Grace on your home screen from the browser? Uninstall that one first, so notifications don&apos;t come twice.
        </p>
      </div>
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
