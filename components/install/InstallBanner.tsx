"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useInstall } from "./install-store";
import { IosSteps } from "./InstallSteps";

const DISMISSED_KEY = "install-banner-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false; // storage blocked: show it, dismissing just won't stick
  }
}

/**
 * One-time suggestion on the dashboard home, phones only, and only when the
 * device can actually install right now (browser prompt, or iPhone steps).
 * "Not now" hides it on this device for good; My Account keeps the option.
 */
export function InstallBanner() {
  const { mode, justInstalled, promptInstall } = useInstall();
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
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // nothing to do — it simply shows again next visit
    }
  }

  async function install() {
    const outcome = await promptInstall();
    // Either way, don't ask again on this device: they've made their choice.
    if (outcome !== "unavailable") dismiss();
  }

  if (!phone || hidden || justInstalled || (mode !== "prompt" && mode !== "ios")) return null;

  return (
    <section aria-label="Install the app" className="card-elevated flex items-start gap-3 rounded-2xl p-4 motion-safe:animate-fade-in">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-parchment text-gold">
        <Smartphone className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Install Grace on your phone</p>
        <p className="mt-0.5 text-xs text-ink/60">Opens from your home screen, full screen, like any other app.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mode === "prompt" ? (
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
          <IosSteps />
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
