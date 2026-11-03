/**
 * window.GraceAndroid: present only inside Grace's Android app
 * (android/app/src/main/java/stream/gracebound/grace/Bridge.kt).
 * Everywhere else these helpers do nothing.
 */
export interface GraceAndroid {
  version(): number;
  /** This phone's push address once Firebase is set up; "" until then. */
  fcmToken(): string;
  setBadge(count: number): void;
  /** Earpiece + screen off at your ear (voice), loudspeaker (video), or back to normal. */
  inCall(mode: "voice" | "video" | "none"): void;
  setSpeaker(on: boolean): void;
  notificationsAllowed(): boolean;
  fullScreenCallsAllowed(): boolean;
  batteryUnrestricted(): boolean;
  openSettings(which: "fullscreen" | "battery" | "callsound" | "notifications"): void;
}

export function graceAndroid(): GraceAndroid | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { GraceAndroid?: GraceAndroid }).GraceAndroid ?? null);
}

/** Where members download the app (published by .github/workflows/android.yml). */
export const ANDROID_APK_URL = "https://github.com/Shona31-art/Church/releases/latest/download/grace.apk";

const REGISTERED_KEY = "grace-android-registered";

/** Tells the server this phone belongs to `userId` (once per person + token). */
export async function registerAndroidPhone(userId: string): Promise<void> {
  const app = graceAndroid();
  const token = app?.fcmToken();
  if (!app || !token) return;
  const marker = `${userId}:${token}`;
  try {
    if (localStorage.getItem(REGISTERED_KEY) === marker) return;
  } catch {
    // No storage: register every time, which is harmless.
  }
  const res = await fetch("/api/android/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, version: app.version() }),
  }).catch(() => null);
  if (res?.ok) {
    try {
      localStorage.setItem(REGISTERED_KEY, marker);
    } catch {
      // Fine.
    }
  }
}

/** Signing out: stop calls and pop-ups for this person reaching this phone. */
export async function forgetAndroidPhone(): Promise<void> {
  const token = graceAndroid()?.fcmToken();
  if (!token) return;
  await fetch("/api/android/register", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
  try {
    localStorage.removeItem(REGISTERED_KEY);
  } catch {
    // Fine.
  }
}
