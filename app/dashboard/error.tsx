"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches any unexpected error thrown while rendering a dashboard page, so
// people see a recovery path instead of a raw stack trace. The real error is
// logged (and sent to your log drain in production), never shown.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
  }, [error]);

  return (
    <div className="max-w-md card-elevated rounded-2xl p-6" role="alert">
      <h1 className="text-xl font-semibold">⚠ Something went wrong loading this page</h1>
      <p className="text-sm text-ink/60 mt-2">
        This is usually temporary. Try again — if it keeps happening, let your church admin know
        {error.digest ? ` and mention reference ${error.digest}` : ""}.
      </p>
      <div className="flex gap-3 mt-5">
        <button onClick={reset} className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium">
          Try again
        </button>
        <Link href="/dashboard" className="border border-ink/15 px-4 py-2 rounded-lg text-sm">
          Go home
        </Link>
      </div>
    </div>
  );
}
