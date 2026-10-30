import { NextResponse } from "next/server";
import { z } from "zod";
import { safePath, sendErrorReport } from "@/lib/error-reporting";

/**
 * POST /api/errors — errors from people's browsers (components/ErrorReporter.tsx
 * and the error pages), forwarded to Sentry so the DSN stays on the server.
 *
 * Only accepted from this site's own pages (Origin must match the host). The
 * body is size-capped and validated; messages are scrubbed of emails and
 * phone numbers before sending. Always answers 204 so a broken tracker never
 * shows up as a second error in the browser.
 */

const Report = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(2000).optional(),
  digest: z.string().max(100).optional(),
});

const MAX_BODY = 12_000;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return new NextResponse(null, { status: 403 });

  const text = await request.text();
  if (text.length > MAX_BODY) return new NextResponse(null, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = Report.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const { message, stack, url, digest } = parsed.data;
  await sendErrorReport({ message, stack, digest, path: safePath(url), source: "browser" });
  return new NextResponse(null, { status: 204 });
}
