"use client";

import { useRef } from "react";
import { Smartphone } from "lucide-react";
import { useInstall } from "./install-store";
import { InstallApp } from "./InstallApp";

/**
 * "Install the app" in the dashboard menu: always there until Grace is
 * installed on this device, unlike the home-page card, which can be dismissed.
 */
export function InstallMenuItem() {
  const { mode, justInstalled, installedOnDevice } = useInstall();
  const dialogRef = useRef<HTMLDialogElement>(null);
  if (mode === null || mode === "installed" || justInstalled || installedOnDevice) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="group flex w-full items-center gap-3 rounded-lg border border-gold/40 bg-gold/[0.08] px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-gold/[0.14]"
      >
        <Smartphone aria-hidden className="h-[18px] w-[18px] shrink-0 text-gold" />
        Install the app
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="install-menu-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] motion-safe:animate-modal-in"
      >
        <div className="p-6">
          <h2 id="install-menu-title" className="text-xl font-semibold">
            Install Grace
          </h2>
          <div className="rule-gold mb-5 mt-3" />
          <InstallApp />
          <div className="mt-6 flex justify-end">
            <button type="button" autoFocus className="btn-secondary" onClick={() => dialogRef.current?.close()}>
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
