"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BatteryCharging, Bell, Download, Music, PhoneCall } from "lucide-react";
import { graceAndroid } from "@/lib/android";

type Status = { notifications: boolean; fullScreen: boolean; battery: boolean; push: boolean };

/**
 * My account → Notifications. Inside the Android app: the phone settings
 * calls need, each with a button straight to it. On an Android browser: a
 * link to get the app. Elsewhere: nothing.
 */
export function AndroidAppCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [androidBrowser, setAndroidBrowser] = useState(false);

  useEffect(() => {
    const read = () => {
      const app = graceAndroid();
      if (!app) return setAndroidBrowser(/Android/i.test(navigator.userAgent));
      setStatus({ notifications: app.notificationsAllowed(), fullScreen: app.fullScreenCallsAllowed(), battery: app.batteryUnrestricted(), push: Boolean(app.fcmToken()) });
    };
    read();
    // Coming back from the phone's settings: show the new state.
    window.addEventListener("grace-android-resume", read);
    window.addEventListener("grace-android-token", read);
    return () => {
      window.removeEventListener("grace-android-resume", read);
      window.removeEventListener("grace-android-token", read);
    };
  }, []);

  if (!status) {
    if (!androidBrowser) return null;
    return (
      <div className="mt-5 rounded-2xl border border-gold/50 bg-gold/5 p-4">
        <p className="font-medium">Get the Android app</p>
        <p className="mt-1 text-sm text-ink/70">Calls ring full screen even when Grace is closed, and the app icon shows your unread count.</p>
        <Link href="/android" className="btn-secondary mt-3">
          <Download aria-hidden className="h-4 w-4" /> Download Grace for Android
        </Link>
      </div>
    );
  }

  const app = graceAndroid()!;
  const rows: { ok: boolean; label: string; help: string; fix: string; icon: React.ReactNode; open: Parameters<typeof app.openSettings>[0] }[] = [
    { ok: status.notifications, label: "Notifications", help: "Needed for calls and messages.", fix: "Turn on", icon: <Bell aria-hidden className="h-4 w-4" />, open: "notifications" },
    { ok: status.fullScreen, label: "Ring over the lock screen", help: "Shows a ringing call full screen, like a phone call.", fix: "Allow", icon: <PhoneCall aria-hidden className="h-4 w-4" />, open: "fullscreen" },
    { ok: status.battery, label: "No battery limits", help: "Stops your phone delaying calls to save battery.", fix: "Allow", icon: <BatteryCharging aria-hidden className="h-4 w-4" />, open: "battery" },
  ];

  return (
    <fieldset className="mt-5 border-t border-line pt-5">
      <legend className="font-medium">Android app</legend>
      {!status.push && <p className="mt-1 text-sm text-ink/70">Calls and pop-ups aren&apos;t switched on for the app yet — your church admin needs to finish setting them up.</p>}
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
            <span className="min-w-0 text-sm">
              <span className="flex items-center gap-2 font-medium">
                {r.icon} {r.label}
              </span>
              <span className="block text-xs text-ink/60">{r.help}</span>
            </span>
            {r.ok ? (
              <span className="shrink-0 text-sm font-medium text-green-700">On ✓</span>
            ) : (
              <button type="button" className="btn-secondary shrink-0" onClick={() => app.openSettings(r.open)}>
                {r.fix}
              </button>
            )}
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
          <span className="min-w-0 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Music aria-hidden className="h-4 w-4" /> Call ringtone
            </span>
            <span className="block text-xs text-ink/60">When Grace is closed, calls ring with this phone&apos;s ringtone. Pick any sound, including a song on your phone.</span>
          </span>
          <button type="button" className="btn-secondary shrink-0" onClick={() => app.openSettings("callsound")}>
            Change
          </button>
        </li>
      </ul>
    </fieldset>
  );
}
