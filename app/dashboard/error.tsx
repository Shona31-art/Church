"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches any unexpected error while rendering a dashboard page, so people
// get a way forward instead of a stack trace. The real error is logged
// server-side (and to your log drain in production), never shown.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
  }, [error]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="max-w-lg card-elevated rounded-2xl p-6" role="alert">
      <p aria-hidden className="text-2xl text-danger">⚠</p>
      <h1 className="mt-2 text-xl font-semibold">{offline ? "You're offline" : "Something went wrong loading this page"}</h1>
      <p className="text-sm text-ink/70 mt-2">
        {offline
          ? "Check your internet connection, then try again. Nothing you saved earlier was lost."
          : `This is usually temporary. Try again — if it keeps happening, open a support ticket${error.digest ? ` and mention reference ${error.digest}` : ""}.`}
      </p>
      <div className="flex flex-wrap gap-2 mt-5">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/dashboard" className="btn-secondary">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
