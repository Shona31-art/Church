"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

/** Reports uncaught browser errors and unhandled promise rejections (see lib/report-client-error.ts). */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Cross-origin script errors arrive as a bare "Script error." with no detail — nothing useful to send.
      if (e.message === "Script error." && !e.error) return;
      reportClientError(e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
