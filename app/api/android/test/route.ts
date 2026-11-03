import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverToAndroid, fcmSetupProblem } from "@/lib/fcm";

/**
 * POST /api/android/test — "Test ring" in the Android app (My account →
 * Notifications → Android app). Checks each step calls depend on, registers
 * this phone if it wasn't, then (after `delaySeconds`, so there's time to
 * lock the phone) rings it like an incoming call. Only ever rings the signed-in
 * person's own phones.
 *
 * Request: JSON { token, delaySeconds? (0–15) }
 * Response: 200 { ok: true, sent } · 200 { ok: false, problem } (what to fix) · 400 · 401
 */
export const maxDuration = 30;

const Body = z.object({ token: z.string().max(4096).optional(), delaySeconds: z.number().int().min(0).max(15).optional() });

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const { data: auth } = await createClient().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const setup = fcmSetupProblem();
  if (setup) return NextResponse.json({ ok: false, problem: setup });
  if (!body.data.token || body.data.token.length < 20) {
    return NextResponse.json({
      ok: false,
      problem:
        "The server is set up, but Firebase didn't start on this phone. Close Grace completely (swipe it away from recent apps) and open it again. If this keeps showing, check that the Android app in Firebase has the package name stream.gracebound.grace, and that google-services.json in Vercel came from that app.",
    });
  }

  // Make sure this very phone is registered to this person.
  const { error } = await createAdminClient()
    .from("android_devices")
    .upsert({ token: body.data.token!, user_id: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) {
    const missing = error.code === "42P01" || /android_devices/.test(error.message);
    return NextResponse.json({ ok: false, problem: missing ? "Run android_devices.sql (#53) in Supabase." : `Database: ${error.message}` });
  }

  if (body.data.delaySeconds) await new Promise((r) => setTimeout(r, body.data.delaySeconds! * 1000));
  const result = await deliverToAndroid(
    auth.user.id,
    { type: "call", callId: randomUUID(), title: "Grace test call", video: "0", url: "/dashboard/account" },
    { urgent: true, ttlSeconds: 60 }
  );
  return NextResponse.json(result.sent ? { ok: true, sent: result.sent } : { ok: false, problem: result.problem ?? "Firebase didn't accept the test." });
}
