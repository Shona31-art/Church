"use client";

import { useEffect } from "react";
import { showToast } from "@/components/ui/Toaster";

/**
 * Registers public/sw.js (offline Bible reading, the offline page, phone
 * pop-ups). Production only: in development the dev server's
 * constantly-changing files and hot reloading don't mix with a caching
 * worker. Offline downloads still save in development; only opening the
 * reader with no connection needs the worker.
 *
 * Updates: the browser re-checks sw.js on each visit, and we also check when
 * the app comes back to the foreground — an installed app can stay open for
 * days. When a new version takes over mid-session, we say so once.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    // Already controlled = this isn't the first install, so a change of
    // controller means an update (not just "the worker started").
    const hadController = Boolean(navigator.serviceWorker.controller);
    let announced = false;
    const onControllerChange = () => {
      if (!hadController || announced) return;
      announced = true;
      showToast("Grace has been updated. Refresh the page when it suits you to get the latest version.", "info");
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | null = null;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
      })
      .catch((error) => {
        // Not fatal: the app works online without it.
        console.error("[sw] registration failed:", error);
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
