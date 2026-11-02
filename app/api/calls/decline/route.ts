import { NextResponse } from "next/server";
import { z } from "zod";
import { endCall } from "@/app/dashboard/calls/actions";

/**
 * POST /api/calls/decline — the "Decline" button on an incoming call pop-up
 * (public/sw.js). Uses the person's own session cookie; endCall() checks they
 * were the one being called (otherwise it just ends a two-person call).
 *
 * Request: JSON { callId }. Response: 200 { ok } · 400 bad input · 401 signed out.
 */
export async function POST(request: Request) {
  // JSON only: a plain cross-site form can't send this.
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const parsed = z.object({ callId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected a call id." }, { status: 400 });
  const result = await endCall(parsed.data.callId, "declined");
  if (result.error) return NextResponse.json({ error: result.error }, { status: /session/i.test(result.error) ? 401 : 400 });
  return NextResponse.json({ ok: true });
}
