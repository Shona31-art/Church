"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";
import { removePushSubscription, sendTestPush, setPushPreference } from "@/app/dashboard/account/notification-actions";
import { devicePushState, enablePushOnDevice, workerRegistration, type DevicePushState } from "@/lib/push-client";
import { CATEGORIES, CATEGORY_LABELS, type NotificationCategory } from "@/lib/notifications";

type DeviceState = DevicePushState;

/**
 * My Account → Notifications. Turn phone pop-ups on/off for THIS device, send
 * a test, and choose which kinds of notification pop up (all devices). The
 * bell always shows everything; these settings only affect pop-ups.
 */
export function PushSettings({ initialPreferences }: { initialPreferences: Record<NotificationCategory, boolean> }) {
  const [device, setDevice] = useState<DeviceState>("checking");
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(initialPreferences);

  useEffect(() => {
    devicePushState().then(setDevice);
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const result = await enablePushOnDevice();
      if (result.error) showToast(result.error, "error");
      if (result.state !== "on") return setDevice(result.state);
      setDevice("on");
      showToast("Pop-ups are on for this device.");
    } catch (error) {
      console.error("[push] turn on failed:", error);
      showToast("Couldn't turn on pop-ups on this device. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const subscription = await (await workerRegistration())?.pushManager.getSubscription();
      if (subscription) {
        const res = await removePushSubscription(subscription.endpoint);
        if (!res.ok) return showToast(res.error, "error");
        await subscription.unsubscribe();
      }
      setDevice("off");
      showToast("Pop-ups are off for this device.");
    } catch {
      showToast("Couldn't turn off pop-ups. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const res = await sendTestPush().catch(() => null);
    setBusy(false);
    if (res?.ok) showToast(`Test sent to ${res.sent} device${res.sent === 1 ? "" : "s"}. It should appear in a few seconds.`, "info");
    else showToast(res && !res.ok ? res.error : "Couldn't send the test. Try again.", "error");
  }

  async function togglePref(category: NotificationCategory) {
    const enabled = !prefs[category];
    setPrefs((p) => ({ ...p, [category]: enabled }));
    const res = await setPushPreference(category, enabled).catch(() => null);
    if (!res?.ok) {
      setPrefs((p) => ({ ...p, [category]: !enabled }));
      showToast(res && !res.ok ? res.error : "Couldn't save that setting. Try again.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-parchment p-4">
        <div className="flex min-w-0 gap-3">
          <BellRing aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="font-semibold">Pop-ups on this device</p>
            <p className="mt-0.5 text-sm text-ink/60" role="status">
              {DEVICE_MESSAGES[device]}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {device === "off" && (
            <button type="button" className="btn-primary btn-sm" onClick={turnOn} disabled={busy}>
              {busy ? "Turning on…" : "Turn on"}
            </button>
          )}
          {device === "on" && (
            <>
              <button type="button" className="btn-secondary btn-sm" onClick={test} disabled={busy}>
                Send a test
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={turnOff} disabled={busy}>
                Turn off
              </button>
            </>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="label">Pop up for</legend>
        <p className="hint mb-3 mt-0">Applies to all your devices. The bell always shows everything.</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {CATEGORIES.map((category) => (
            <li key={category} className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor={`push-${category}`} className="min-w-0 cursor-pointer">
                <span className="block text-sm font-semibold">{CATEGORY_LABELS[category].label}</span>
                <span className="block text-sm text-ink/60">{CATEGORY_LABELS[category].description}</span>
              </label>
              <button
                id={`push-${category}`}
                type="button"
                role="switch"
                aria-checked={prefs[category]}
                onClick={() => togglePref(category)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[category] ? "bg-ember" : "bg-ink/20"}`}
              >
                <span className="sr-only">{prefs[category] ? "On" : "Off"}</span>
                <span
                  aria-hidden
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-xs transition-transform ${prefs[category] ? "translate-x-[22px]" : "translate-x-0.5"}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}

const DEVICE_MESSAGES: Record<DeviceState, string> = {
  checking: "Checking this device…",
  unsupported: "This browser can't show pop-ups. Try an up-to-date Chrome, Edge, Firefox or Safari.",
  "ios-install": "On iPhone and iPad, pop-ups only work from the Home Screen app: tap Share, then Add to Home Screen, open it from there and come back here.",
  "not-configured": "Pop-ups aren't set up on this server yet. Ask your administrator. The bell still works.",
  "no-worker": "Pop-ups work in the live app, not in this development version. The bell still works.",
  blocked: "Pop-ups are blocked for this site in your browser settings. Allow notifications for this site there, then reload this page.",
  off: "Off. Turn on to get a pop-up when something happens, even when the app is closed.",
  on: "On. You'll get pop-ups on this device.",
};
