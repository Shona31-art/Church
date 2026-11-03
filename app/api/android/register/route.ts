import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Grace's Android app tells the server where to send this person's calls and
 * pop-ups (components/AndroidBridge.tsx, inside the app only).
 *
 * POST   { token, version } — this phone now belongs to the signed-in person
 *                             (moves from whoever used it before).
 * DELETE { token }          — signed out on this phone: stop sending here.
 * Responses: 200 { ok } · 400 bad input · 401 signed out · 503 database not updated.
 */
const Body = z.object({ token: z.string().min(20).max(4096), version: z.number().int().min(0).max(1e9).optional() });

async function parse(request: Request) {
  // JSON only: a plain cross-site form can't send this.
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

export async function POST(request: Request) {
  const body = await parse(request);
  if (!body) return NextResponse.json({ error: "Expected a token." }, { status: 400 });
  const { data: auth } = await createClient().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Server only: the table has no policies, so nobody can read others' phones.
  const { error } = await createAdminClient()
    .from("android_devices")
    .upsert({ token: body.token, user_id: auth.user.id, app_version: body.version ?? null, updated_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) {
    console.error("[android] register failed:", error.message);
    return NextResponse.json({ error: error.code === "42P01" ? "Run android_devices.sql first." : "Couldn't register this phone." }, { status: error.code === "42P01" ? 503 : 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await parse(request);
  if (!body) return NextResponse.json({ error: "Expected a token." }, { status: 400 });
  const { data: auth } = await createClient().auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  await createAdminClient().from("android_devices").delete().eq("token", body.token).eq("user_id", auth.user.id);
  return NextResponse.json({ ok: true });
}
