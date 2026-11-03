import { NextResponse } from "next/server";
import { androidAppConfig, fcmConfigured } from "@/lib/fcm";

/**
 * GET /api/android/config — what Grace's Android app needs to start Firebase
 * push (android/…/Push.kt). These values are public: they're inside every
 * copy of an app. Sending still needs the secret service account, which
 * never leaves the server.
 *
 * Response: 200 { enabled: false } until Firebase is set up in Vercel, then
 * { enabled: true, appId, apiKey, projectId, senderId }.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const config = fcmConfigured() ? androidAppConfig() : null;
  return NextResponse.json(config ? { enabled: true, ...config } : { enabled: false }, { headers: { "cache-control": "no-store" } });
}
