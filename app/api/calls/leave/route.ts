import { NextResponse } from "next/server";
import { z } from "zod";
import { callPresence } from "@/app/dashboard/calls/actions";

/**
 * POST /api/calls/leave — sent by the call screen as the page closes
 * (navigator.sendBeacon), so closing the app counts as leaving a group call.
 * The person's own session cookie; only their own place in the call.
 *
 * Request: JSON { callId }. Response: 204 · 400 bad input.
 */
export async function POST(request: Request) {
  // JSON only: a plain cross-site form can't send this.
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const parsed = z.object({ callId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected a call id." }, { status: 400 });
  await callPresence(parsed.data.callId, false);
  return new NextResponse(null, { status: 204 });
}
