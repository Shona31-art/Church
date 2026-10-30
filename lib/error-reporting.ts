// Error tracking: sends errors to Sentry (or any Sentry-compatible service,
// e.g. GlitchTip) when SENTRY_DSN is set. No SDK — one small HTTP call to the
// service's envelope endpoint, so nothing new in the bundle and nothing runs
// when the variable is unset (errors still go to the server log as before).
//
// Privacy: this app holds counselling notes, prayers and journals, so events
// carry only the error message and stack, the page path (no query string)
// and the runtime — never request bodies, cookies or user details — and
// email addresses and phone numbers are masked in the text first.

export interface ParsedDsn {
  /** https://host/api/<project>/envelope/ */
  envelopeUrl: string;
  publicKey: string;
  dsn: string;
}

/** Splits https://<key>@<host>/<project> into the parts the envelope endpoint needs. */
export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!url.username || !project || !/^https?:$/.test(url.protocol)) return null;
    const prefix = project.includes("/") ? `/${project.slice(0, project.lastIndexOf("/"))}` : "";
    const id = project.slice(project.lastIndexOf("/") + 1);
    return { envelopeUrl: `${url.protocol}//${url.host}${prefix}/api/${id}/envelope/`, publicKey: url.username, dsn };
  } catch {
    return null;
  }
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Phone-like runs: 9+ digits allowing spaces, dashes and a leading +.
const PHONE = /\+?\d[\d\s-]{7,}\d/g;

/** Masks email addresses and phone numbers, and caps the length. */
export function scrub(text: string, max = 4000): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]").slice(0, max);
}

/** The page path only — query strings can carry search terms or tokens. */
export function safePath(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, "http://local").pathname.slice(0, 300);
  } catch {
    return undefined;
  }
}

export interface ErrorReport {
  message: string;
  stack?: string;
  /** "server" or "browser". */
  source: "server" | "browser";
  path?: string;
  /** Next.js error digest, so a support ticket's reference can be found. */
  digest?: string;
  /** Short label for where it came from, e.g. "posters" from "[posters] export failed". */
  area?: string;
}

/** Turns a console.error(...) argument list into a report: "[area] text", plus the first Error's stack. */
export function reportFromConsoleArgs(args: unknown[]): ErrorReport | null {
  const error = args.find((a): a is Error => a instanceof Error);
  const text = args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!text && !error) return null;
  const area = /^\[([a-z0-9 _-]{1,40})\]/i.exec(text)?.[1];
  return { message: text || error!.message, stack: error?.stack, source: "server", area };
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The Sentry envelope (three newline-separated JSON lines) for one error. */
export function buildEnvelope(report: ErrorReport, dsn: ParsedDsn, env: { environment?: string; release?: string } = {}, now = new Date()): { eventId: string; body: string } {
  const eventId = randomId();
  const message = scrub(report.message, 1000);
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    platform: "javascript",
    level: "error",
    logger: report.area ?? report.source,
    environment: env.environment ?? "production",
    release: env.release,
    tags: { source: report.source, ...(report.area ? { area: report.area } : {}), ...(report.digest ? { digest: report.digest } : {}) },
    transaction: report.path,
    request: report.path ? { url: report.path } : undefined,
    exception: {
      values: [{ type: report.area ? `[${report.area}]` : "Error", value: message }],
    },
    extra: report.stack ? { stack: scrub(report.stack, 8000) } : undefined,
  };
  const header = { event_id: eventId, sent_at: now.toISOString(), dsn: dsn.dsn };
  return { eventId, body: `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}` };
}

/**
 * At most `limit` reports per minute from this server instance, and the same
 * message at most once a minute, so an error in a loop can't flood the
 * tracker (or use up a free plan's quota).
 */
export function createRateLimiter(limit = 30, windowMs = 60_000) {
  let windowStart = 0;
  let count = 0;
  const recent = new Map<string, number>();
  return (key: string, now = Date.now()): boolean => {
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
      recent.clear();
    }
    if (count >= limit || recent.has(key)) return false;
    count++;
    recent.set(key, now);
    return true;
  };
}

const allow = createRateLimiter();

/** Is error tracking switched on for this server? */
export function errorTrackingConfigured(): boolean {
  return parseDsn(process.env.SENTRY_DSN) !== null;
}

/**
 * Sends one report. Never throws and never logs through console.error (that
 * would report itself); failures are silent because the original error has
 * already been written to the server log.
 */
export async function sendErrorReport(report: ErrorReport, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn || !allow(`${report.source}:${report.message.slice(0, 200)}`)) return false;
  try {
    const { body } = buildEnvelope(report, dsn, {
      environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });
    const res = await fetchImpl(`${dsn.envelopeUrl}?sentry_key=${encodeURIComponent(dsn.publicKey)}&sentry_version=7&sentry_client=grace-bound%2F1.0`, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
