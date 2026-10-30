// Browser side of error tracking: posts an error to /api/errors (which
// forwards it to Sentry when the server has SENTRY_DSN). Best effort and
// silent — a failure here must never cause another error on screen.

const sent = new Set<string>();
const MAX_PER_PAGE = 10;

export function reportClientError(error: unknown, digest?: string) {
  if (typeof window === "undefined") return;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const key = `${err.message}|${digest ?? ""}`;
  if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
  sent.add(key);
  const body = JSON.stringify({
    message: err.message.slice(0, 1000) || "Error",
    stack: err.stack?.slice(0, 8000),
    url: window.location.pathname,
    digest,
  });
  try {
    // keepalive: the report still goes if the person is navigating away.
    void fetch("/api/errors", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  } catch {
    // Ignore: reporting is best effort.
  }
}
