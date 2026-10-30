// Runs once when a server instance starts (Next.js instrumentation hook).
//
// Error tracking: every server-side `console.error(...)` — the app's single
// way of logging failures, e.g. "[posters] export failed:" — is also sent to
// Sentry when SENTRY_DSN is set, along with unhandled promise rejections.
// The log line itself is unchanged. See lib/error-reporting.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;
  const { errorTrackingConfigured, reportFromConsoleArgs, sendErrorReport } = await import("@/lib/error-reporting");
  if (!errorTrackingConfigured()) {
    console.warn("[errors] SENTRY_DSN is set but isn't a valid DSN — error tracking is off.");
    return;
  }

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    const report = reportFromConsoleArgs(args);
    if (report) void sendErrorReport(report);
  };
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    void sendErrorReport({ message: `Unhandled rejection: ${error.message}`, stack: error.stack, source: "server", area: "unhandled" });
  });
}
