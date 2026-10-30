"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { reportClientError } from "@/lib/report-client-error";

// Catches any unexpected error while rendering a dashboard page, so people
// get a way forward instead of a stack trace. The real error is logged
// server-side and, when SENTRY_DSN is set, sent to error tracking — never shown.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
    reportClientError(error, error.digest);
  }, [error]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="max-w-lg card-elevated rounded-2xl p-6" role="alert">
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-tint text-danger">
        <TriangleAlert className="h-5 w-5" strokeWidth={2} />
      </span>
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
