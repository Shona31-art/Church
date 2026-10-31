// Phone pop-ups (Web Push) on this device — shared by My account →
// Notifications and the contextual prompt (components/notifications/PushPrompt.tsx).
// Browser only.

import { savePushSubscription } from "@/app/dashboard/account/notification-actions";

export type DevicePushState =
  | "checking"
  | "unsupported" // browser has no Web Push
  | "ios-install" // iPhone/iPad Safari: only works from the Home Screen
  | "not-configured" // server has no VAPID key
  | "no-worker" // development build: the service worker isn't registered
  | "blocked" // permission denied in the browser
  | "off"
  | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** The VAPID public key as the bytes PushManager.subscribe() wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function workerRegistration(): Promise<ServiceWorkerRegistration | null> {
  // getRegistration() resolves immediately (ready would wait forever in development).
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

export async function devicePushState(): Promise<DevicePushState> {
  try {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (ios && !standalone) return "ios-install";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    if (!VAPID_PUBLIC_KEY) return "not-configured";
    if (Notification.permission === "denied") return "blocked";
    const registration = await workerRegistration();
    if (!registration) return "no-worker";
    return (await registration.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** Asks the browser for permission and registers this device. Resolves to the new state, or an error message. */
export async function enablePushOnDevice(): Promise<{ state: DevicePushState; error?: string }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { state: permission === "denied" ? "blocked" : "off" };
  const registration = await workerRegistration();
  if (!registration) return { state: "no-worker" };
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) }));
  const res = await savePushSubscription(subscription.toJSON(), navigator.userAgent);
  if (!res.ok) {
    await subscription.unsubscribe().catch(() => undefined);
    return { state: "off", error: res.error };
  }
  return { state: "on" };
}
