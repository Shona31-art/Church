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

/** Text pasted from a phone: smart quotes, invisible characters and stray wrapping are undone. */
function tidy(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u00A0\u200B]/g, " ")
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "");
}

/** A "key": "value" pair from JSON-ish text, even when the whole thing won't parse. */
function field(text: string, key: string): string | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
  return m?.[1];
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const text = tidy(raw);
  let parsed: Partial<ServiceAccount> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { client_email: field(text, "client_email"), private_key: field(text, "private_key"), project_id: field(text, "project_id") };
  }
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n"), project_id: parsed.project_id };
}

export function fcmConfigured(): boolean {
  return serviceAccount() !== null && androidAppConfig() !== null;
}

/** What the Android app needs to start Firebase, from google-services.json. Public values. */
export function androidAppConfig(): { appId: string; apiKey: string; projectId: string; senderId: string } | null {
  const raw = process.env.FIREBASE_ANDROID_APP;
  if (!raw) return null;
  const text = tidy(raw);
  let found: Record<string, unknown> = {};
  try {
    const json = JSON.parse(text);
    const clients = (json.client ?? []) as any[];
    const client = clients.find((c) => c?.client_info?.android_client_info?.package_name === ANDROID_PACKAGE) ?? clients[0];
    found = { appId: client?.client_info?.mobilesdk_app_id, apiKey: client?.api_key?.[0]?.current_key, projectId: json.project_info?.project_id, senderId: json.project_info?.project_number };
  } catch {
    // Cut short or changed by copying: pick the four values out of the text.
    found = { appId: field(text, "mobilesdk_app_id"), apiKey: field(text, "current_key"), projectId: field(text, "project_id"), senderId: field(text, "project_number") };
  }
  const { appId, apiKey, projectId, senderId } = found;
  if (![appId, apiKey, projectId, senderId].every((v) => typeof v === "string" && v)) return null;
  return { appId, apiKey, projectId, senderId } as { appId: string; apiKey: string; projectId: string; senderId: string };
}

/** Why FIREBASE_ANDROID_APP can't be used, as specifically as possible. */
function androidAppProblem(): string {
  const text = tidy(process.env.FIREBASE_ANDROID_APP ?? "");
  if (/private_key|service_account/.test(text)) return "FIREBASE_ANDROID_APP holds the private key file. Swap them: the private key goes in FIREBASE_SERVICE_ACCOUNT, and google-services.json in FIREBASE_ANDROID_APP.";
  if (/com\.google\.gms|implementation\(|plugins\s*\{/.test(text)) return "FIREBASE_ANDROID_APP holds the Gradle code from Firebase's set-up page, not the file. Paste the contents of google-services.json instead.";
  const missing = [
    ["mobilesdk_app_id", "the app id"],
    ["current_key", "the API key"],
    ["project_id", "the project id"],
    ["project_number", "the project number"],
  ]
    .filter(([key]) => !field(text, key))
    .map(([, label]) => label);
  return `FIREBASE_ANDROID_APP isn't a complete google-services.json (missing ${missing.join(", ") || "parts"}; it's ${text.length} characters long — the real file is usually 600–900). Paste the whole file again, from the first { to the last }.`;
}

let cachedToken: { value: string; expires: number } | null = null;

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** A short-lived Google access token from the service account (signed JWT, no SDK). */
async function accessToken(account: ServiceAccount): Promise<{ token: string } | { problem: string }> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return { token: cachedToken.value };
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  let assertion: string;
  try {
    const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
    assertion = `${header}.${claims}.${base64url(signature)}`;
  } catch (err) {
    console.error("[fcm] the service account key couldn't sign:", (err as Error).message);
    return { problem: "FIREBASE_SERVICE_ACCOUNT's private key is damaged — paste the whole key file again." };
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
      return { problem: `Google refused FIREBASE_SERVICE_ACCOUNT (${json.error_description ?? res.status}). Generate a new private key and paste it again.` };
    }
    cachedToken = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return { token: cachedToken.value };
  } catch (err) {
    console.error("[fcm] token request failed:", (err as Error).message);
    return { problem: "Couldn't reach Google from the server — try again." };
  }
}

export type AndroidPush = Record<string, string>;

/** What's missing on the server for the Android app, in plain words; null when ready. */
export function fcmSetupProblem(): string | null {
  if (!process.env.FIREBASE_ANDROID_APP) return "FIREBASE_ANDROID_APP isn't set in Vercel (or Vercel wasn't redeployed after adding it).";
  if (!androidAppConfig()) return androidAppProblem();
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return "FIREBASE_SERVICE_ACCOUNT isn't set in Vercel (or Vercel wasn't redeployed after adding it).";
  if (!serviceAccount()) {
    const text = tidy(process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
    return /mobilesdk_app_id|project_info/.test(text)
      ? "FIREBASE_SERVICE_ACCOUNT holds google-services.json. Swap them: google-services.json goes in FIREBASE_ANDROID_APP, the private key file in FIREBASE_SERVICE_ACCOUNT."
      : `FIREBASE_SERVICE_ACCOUNT isn't a complete private key file (${text.length} characters — the real one is about 2,300). Paste the whole file again, from the first { to the last }.`;
  }
  return null;
}

/**
 * Sends to every Android app this person is signed in to. Never throws.
 * Phones Firebase says are gone are forgotten. `sent`: how many accepted it;
 * `problem`: why nothing was sent, in plain words.
 */
export async function deliverToAndroid(userId: string, data: AndroidPush, options: { urgent?: boolean; ttlSeconds?: number } = {}): Promise<{ sent: number; phones: number; problem?: string }> {
  const setup = fcmSetupProblem();
  if (setup) return { sent: 0, phones: 0, problem: setup };
  const account = serviceAccount()!;
  const admin = createAdminClient(); // server only: one person's phones
  const { data: devices, error } = await admin.from("android_devices").select("token").eq("user_id", userId);
  if (error) {
    // 42P01: android_devices.sql hasn't been run yet.
    if (error.code !== "42P01") console.error("[fcm] device lookup failed:", error.message);
    return { sent: 0, phones: 0, problem: error.code === "42P01" || /android_devices/.test(error.message) ? "Run android_devices.sql (#53) in Supabase." : `Database: ${error.message}` };
  }
  if (!devices?.length) return { sent: 0, phones: 0, problem: "This phone isn't registered yet — close Grace completely and open it again." };
  const auth = await accessToken(account);
  if ("problem" in auth) return { sent: 0, phones: devices.length, problem: auth.problem };

  let lastProblem: string | undefined;
  const results = await Promise.all(
    devices.map(async ({ token: device }: { token: string }) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
          method: "POST",
          headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
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
          lastProblem = "A registered phone no longer has the app; it's been removed.";
        } else {
          console.error(`[fcm] send failed (${res.status}):`, body.slice(0, 300));
          const reason = /"message":\s*"([^"]+)"/.exec(body)?.[1] ?? String(res.status);
          lastProblem = /SENDER_ID_MISMATCH|PERMISSION_DENIED|mismatch/i.test(body)
            ? "The two Firebase files are from different Firebase projects — download both from the same project."
            : `Firebase refused the message: ${reason}`;
        }
        return false;
      } catch (err) {
        console.error("[fcm] send failed (network):", (err as Error).message);
        lastProblem = "Couldn't reach Firebase from the server — try again.";
        return false;
      }
    })
  );
  const sent = results.filter(Boolean).length;
  return { sent, phones: devices.length, ...(sent ? {} : { problem: lastProblem }) };
}

/** As deliverToAndroid, returning how many phones accepted it. */
export async function sendToAndroid(userId: string, data: AndroidPush, options: { urgent?: boolean; ttlSeconds?: number } = {}): Promise<number> {
  return (await deliverToAndroid(userId, data, options)).sent;
}

/** Stops the ringing on these people's Android phones (the call ended or was declined). */
export async function sendCallEnded(userIds: string[], callId: string): Promise<void> {
  await Promise.all(userIds.map((id) => sendToAndroid(id, { type: "call_end", callId }, { urgent: true, ttlSeconds: 60 }).catch(() => 0)));
}
