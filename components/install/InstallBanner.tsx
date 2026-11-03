"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useInstall } from "./install-store";
import { InstallApp } from "./InstallApp";

const DISMISSED_KEY = "install-banner-dismissed";
/** "Not now" hides the banner for this long, then it may ask again. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

function wasDismissed(): boolean {
  try {
    // Stored as the time of "Not now". The old value "1" (hidden forever) counts as expired.
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return at > 1 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false; // storage blocked: show it, dismissing just won't stick
  }
}

/**
 * Suggestion on the dashboard home, phones only, and only when the device can
 * actually install right now (browser prompt, or iPhone steps). "Not now"
 * hides it for 30 days. Installing doesn't hide it for good: while the app is
 * installed the browser stops offering the prompt, so the banner stays away
 * by itself — and if the app is removed, it can come back. My Account always
 * keeps the option.
 */
export function InstallBanner() {
  const { mode, justInstalled, installedOnDevice, promptInstall } = useInstall();
  const [phone, setPhone] = useState(false);
  const [hidden, setHidden] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setPhone(window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches);
    setHidden(wasDismissed());
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // nothing to do — it simply shows again next visit
    }
  }

  async function install() {
    const outcome = await promptInstall();
    // Declined the browser's prompt: treat like "Not now". Accepted: nothing to
    // store (see above), so a later uninstall can be offered a reinstall.
    if (outcome === "dismissed") dismiss();
    if (outcome === "accepted") setHidden(true);
  }

  // Every phone that isn't running the installed app gets the card — with the
  // one-tap Install where the browser allows it, and "Show me how" otherwise.
  if (!phone || hidden || justInstalled || installedOnDevice || mode === null || mode === "installed") return null;

  return (
    <section aria-label="Install the app" className="card-elevated flex items-start gap-3 rounded-2xl p-4 motion-safe:animate-fade-in">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-parchment text-gold">
        <Smartphone className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{mode === "android-app" ? "Get the Grace Android app" : "Install Grace on your phone"}</p>
        <p className="mt-0.5 text-xs text-ink/60">
          {mode === "android-app" ? "Calls ring like a phone call, even when Grace is closed." : "Opens from your home screen, full screen, like any other app."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mode === "android-app" ? (
            <Link href="/android" className="btn-primary btn-sm">
              <Download aria-hidden className="h-3.5 w-3.5" /> Get the app
            </Link>
          ) : mode === "prompt" ? (
            <button type="button" onClick={install} className="btn-primary btn-sm">
              <Download aria-hidden className="h-3.5 w-3.5" /> Install
            </button>
          ) : (
            <button type="button" onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog" className="btn-primary btn-sm">
              Show me how
            </button>
          )}
          <button type="button" onClick={dismiss} className="btn-ghost btn-sm">
            Not now
          </button>
        </div>
      </div>
      <button type="button" onClick={dismiss} className="btn-ghost btn-icon -mr-2 -mt-2 h-9 w-9" aria-label="Dismiss install suggestion">
        <X aria-hidden className="h-4 w-4" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="ios-install-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] motion-safe:animate-modal-in"
      >
        <div className="p-6">
          <h2 id="ios-install-title" className="text-xl font-semibold">
            Add Grace to your home screen
          </h2>
          <div className="rule-gold mb-5 mt-3" />
          <InstallApp />
          <div className="mt-6 flex justify-end">
            <button type="button" autoFocus className="btn-secondary" onClick={() => dialogRef.current?.close()}>
              Done
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
