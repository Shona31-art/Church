import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildEnvelope, createRateLimiter, parseDsn, reportFromConsoleArgs, safePath, scrub, sendErrorReport } from "@/lib/error-reporting";

const DSN = "https://abc123@o42.ingest.sentry.io/4507";

describe("error reporting helpers", () => {
  test("parses a Sentry DSN into the envelope endpoint", () => {
    expect(parseDsn(DSN)).toEqual({ envelopeUrl: "https://o42.ingest.sentry.io/api/4507/envelope/", publicKey: "abc123", dsn: DSN });
    expect(parseDsn("https://key@sentry.example.org/sub/9")?.envelopeUrl).toBe("https://sentry.example.org/sub/api/9/envelope/");
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://o42.ingest.sentry.io/4507")).toBeNull(); // no key
  });

  test("masks emails and phone numbers, and keeps only the path of a URL", () => {
    expect(scrub("Invite to thandi@example.org failed, call +27 82 555 1234")).toBe("Invite to [email] failed, call [phone]");
    expect(safePath("https://app.example/dashboard/members?q=thandi")).toBe("/dashboard/members");
    expect(safePath("/dashboard/chat/abc?x=1")).toBe("/dashboard/chat/abc");
  });

  test("turns console.error arguments into a report with an area", () => {
    const error = new Error("boom");
    expect(reportFromConsoleArgs(["[posters] export failed:", error])).toMatchObject({ message: "[posters] export failed: boom", stack: error.stack, area: "posters" });
    expect(reportFromConsoleArgs([])).toBeNull();
  });

  test("builds a three-line envelope without stray personal data", () => {
    const { eventId, body } = buildEnvelope({ message: "Failed for a@b.co", source: "browser", path: "/dashboard" }, parseDsn(DSN)!, { environment: "preview" });
    const [header, item, event] = body.split("\n").map((l) => JSON.parse(l));
    expect(header).toMatchObject({ event_id: eventId, dsn: DSN });
    expect(item).toEqual({ type: "event" });
    expect(event.environment).toBe("preview");
    expect(event.exception.values[0].value).toBe("Failed for [email]");
    expect(JSON.stringify(event)).not.toContain("a@b.co");
  });

  test("rate-limits per window and drops repeats", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 1)).toBe(false); // same message
    expect(allow("b", 2)).toBe(true);
    expect(allow("c", 3)).toBe(false); // over the limit
    expect(allow("c", 1003)).toBe(true); // new window
  });
});

describe("sendErrorReport", () => {
  beforeEach(() => {
    process.env.SENTRY_DSN = DSN;
  });
  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });

  test("does nothing without a DSN", async () => {
    delete process.env.SENTRY_DSN;
    const fetchImpl = vi.fn();
    expect(await sendErrorReport({ message: "x", source: "server" }, fetchImpl as unknown as typeof fetch)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("posts the envelope with the public key, and never throws", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    expect(await sendErrorReport({ message: "unique one", source: "server" }, fetchImpl as unknown as typeof fetch)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://o42.ingest.sentry.io/api/4507/envelope/?sentry_key=abc123");
    expect(init.headers).toMatchObject({ "content-type": "application/x-sentry-envelope" });

    const failing = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await sendErrorReport({ message: "unique two", source: "server" }, failing as unknown as typeof fetch)).toBe(false);
  });
});

describe("POST /api/errors", async () => {
  const sendErrorReportMock = vi.fn(async () => true);
  vi.doMock("@/lib/error-reporting", async (importOriginal) => ({ ...(await importOriginal<object>()), sendErrorReport: sendErrorReportMock }));
  const { POST } = await import("@/app/api/errors/route");
  const call = (body: unknown, origin: string | null = "http://localhost") =>
    POST(
      new Request("http://localhost/api/errors", {
        method: "POST",
        headers: { "content-type": "application/json", host: "localhost", ...(origin ? { origin } : {}) },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  test("accepts same-origin reports and forwards only the path", async () => {
    const res = await call({ message: "TypeError: x is undefined", url: "http://localhost/dashboard/giving?amount=5", digest: "123" });
    expect(res.status).toBe(204);
    expect(sendErrorReportMock).toHaveBeenCalledWith(expect.objectContaining({ message: "TypeError: x is undefined", path: "/dashboard/giving", digest: "123", source: "browser" }));
  });

  test("refuses other sites, bad JSON and oversized bodies", async () => {
    sendErrorReportMock.mockClear();
    expect((await call({ message: "x" }, "https://evil.example")).status).toBe(403);
    expect((await call({ message: "x" }, null)).status).toBe(403);
    expect((await call("{not json")).status).toBe(400);
    expect((await call({ message: "" })).status).toBe(400);
    expect((await call({ message: "x", stack: "y".repeat(13_000) })).status).toBe(413);
    expect(sendErrorReportMock).not.toHaveBeenCalled();
  });
});
