"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";
import "./globals.css";

// Last-resort error page, shown when the root layout itself fails. It
// replaces the whole document, so it brings its own <html> and styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] root error:", error);
    reportClientError(error, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center" role="alert">
          <h1 className="text-title font-medium">Something went wrong</h1>
          <div className="rule-gold mx-auto mt-4" />
          <p className="mt-4 text-sm text-ink/70">
            Please try again. If it keeps happening, contact your church office{error.digest ? ` and mention reference ${error.digest}` : ""}.
          </p>
          <button type="button" onClick={reset} className="btn-primary mt-6">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
