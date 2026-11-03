import "server-only";
import { createSign } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Pushes to Grace's Android app through Firebase Cloud Messaging (free).
// The app is woken even when closed: calls ring full screen, messages pop up.
// Two Vercel variables turn it on (see .env.example):
//   FIREBASE_SERVICE_ACCOUNT — the service account key file (JSON), secret
//   FIREBASE_ANDROID_APP      — google-services.json for the Android app; not
//                               secret (it's inside every copy of an app), the
//                               app downloads it from /api/android/config
// Payloads are data-only (the app draws the notification itself) and carry
// the same title, short text and in-app link as the web pop-ups.

export const ANDROID_PACKAGE = "stream.gracebound.grace";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const SEND_TIMEOUT_MS = 8000;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n"), project_id: parsed.project_id };
  } catch {
    return null;
  }
}

export function fcmConfigured(): boolean {
  return serviceAccount() !== null && androidAppConfig() !== null;
}

/** What the Android app needs to start Firebase, from google-services.json. Public values. */
export function androidAppConfig(): { appId: string; apiKey: string; projectId: string; senderId: string } | null {
  const raw = process.env.FIREBASE_ANDROID_APP;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const clients = (json.client ?? []) as any[];
    const client = clients.find((c) => c?.client_info?.android_client_info?.package_name === ANDROID_PACKAGE) ?? clients[0];
    const appId = client?.client_info?.mobilesdk_app_id;
    const apiKey = client?.api_key?.[0]?.current_key;
    const projectId = json.project_info?.project_id;
    const senderId = json.project_info?.project_number;
    if (![appId, apiKey, projectId, senderId].every((v) => typeof v === "string" && v)) return null;
    return { appId, apiKey, projectId, senderId };
  } catch {
    return null;
  }
}

let cachedToken: { value: string; expires: number } | null = null;

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** A short-lived Google access token from the service account (signed JWT, no SDK). */
async function accessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  let assertion: string;
  try {
    const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
    assertion = `${header}.${claims}.${base64url(signature)}`;
  } catch (err) {
    console.error("[fcm] the service account key couldn't sign:", (err as Error).message);
    return null;
  }
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !json.access_token) {
      console.error("[fcm] Google refused the service account:", json.error_description ?? res.status);
      return null;
    }
    cachedToken = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return cachedToken.value;
  } catch (err) {
    console.error("[fcm] token request failed:", (err as Error).message);
    return null;
  }
}

export type AndroidPush = Record<string, string>;

/**
 * Sends to every Android app this person is signed in to. Never throws.
 * Phones Firebase says are gone are forgotten. Returns how many accepted it.
 */
export async function sendToAndroid(userId: string, data: AndroidPush, options: { urgent?: boolean; ttlSeconds?: number } = {}): Promise<number> {
  const account = serviceAccount();
  if (!account || !androidAppConfig()) return 0;
  const admin = createAdminClient(); // server only: one person's phones
  const { data: devices, error } = await admin.from("android_devices").select("token").eq("user_id", userId);
  if (error) {
    // 42P01: android_devices.sql hasn't been run yet.
    if (error.code !== "42P01") console.error("[fcm] device lookup failed:", error.message);
    return 0;
  }
  if (!devices?.length) return 0;
  const token = await accessToken(account);
  if (!token) return 0;

  const results = await Promise.all(
    devices.map(async ({ token: device }: { token: string }) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token: device,
              data,
              android: { priority: options.urgent ? "HIGH" : "NORMAL", ttl: `${options.ttlSeconds ?? 86400}s` },
            },
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (res.ok) return true;
        const body = await res.text().catch(() => "");
        if (res.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(body)) {
          // The app was uninstalled or signed in elsewhere: stop sending there.
          await admin.from("android_devices").delete().eq("token", device);
        } else {
          console.error(`[fcm] send failed (${res.status}):`, body.slice(0, 300));
        }
        return false;
      } catch (err) {
        console.error("[fcm] send failed (network):", (err as Error).message);
        return false;
      }
    })
  );
  return results.filter(Boolean).length;
}

/** Stops the ringing on these people's Android phones (the call ended or was declined). */
export async function sendCallEnded(userIds: string[], callId: string): Promise<void> {
  await Promise.all(userIds.map((id) => sendToAndroid(id, { type: "call_end", callId }, { urgent: true, ttlSeconds: 60 }).catch(() => 0)));
}
