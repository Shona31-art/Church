"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (offline Bible reading). Production only: in
 * development the dev server's constantly-changing files and hot reloading
 * don't mix with a caching worker. Offline downloads still save in
 * development; only opening the reader with no connection needs the worker.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      // Not fatal: the app works online without it.
      console.error("[sw] registration failed:", error);
    });
  }, []);
  return null;
}
