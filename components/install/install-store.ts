"use client";

import { useEffect, useState } from "react";
import { detectPlatform, installMode, isInAppBrowser, type InstallMode, type InstallPlatform } from "@/lib/install";

// Browser side of "install the app". The browser fires `beforeinstallprompt`
// once, early, and only if it would let this site install — so we start
// listening as soon as this module loads (it's imported by the dashboard
// shell) and keep the event until someone taps Install.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisVisit = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Stops Chrome's own mini-bar; our button (or banner) offers it instead.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  // The only reliable "it really installed" signal. Until this fires we
  // never tell anyone installation succeeded.
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedThisVisit = true;
    emit();
  });
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export interface InstallState {
  /** null until mounted (server render / first paint), so nothing flickers. */
  mode: InstallMode | null;
  platform: InstallPlatform | null;
  /** The browser confirmed installation during this visit. */
  justInstalled: boolean;
  /** Opens the browser's own prompt. Resolves to what the person chose. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function useInstall(): InstallState {
  const [, setVersion] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const rerender = () => setVersion((v) => v + 1);
    listeners.add(rerender);
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", rerender);
    return () => {
      listeners.delete(rerender);
      media.removeEventListener?.("change", rerender);
    };
  }, []);

  async function promptInstall() {
    const event = deferredPrompt;
    if (!event) return "unavailable" as const;
    // A prompt can only be shown once; the browser may offer a new one later.
    deferredPrompt = null;
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome;
    } catch (error) {
      console.error("[install] prompt failed:", error);
      return "unavailable" as const;
    } finally {
      emit();
    }
  }

  if (!mounted) return { mode: null, platform: null, justInstalled: false, promptInstall };

  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const mode = installMode({
    standalone: isStandalone(),
    hasPrompt: deferredPrompt !== null,
    platform,
    inAppBrowser: isInAppBrowser(navigator.userAgent),
  });
  return { mode, platform, justInstalled: installedThisVisit, promptInstall };
}
