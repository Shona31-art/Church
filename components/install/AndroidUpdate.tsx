"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Download } from "lucide-react";
import { ANDROID_APK_URL, graceAndroid } from "@/lib/android";

/**
 * Inside Grace's Android app: says which version this is and, when a newer
 * one is out, offers it. The new version installs over the old one; the
 * sign-in and settings stay.
 */
export function AndroidUpdate() {
  const [mine, setMine] = useState<number | null>(null);
  const [latest, setLatest] = useState<number | null>(null);

  useEffect(() => {
    const app = graceAndroid();
    if (!app) return;
    try {
      setMine(app.version());
    } catch {
      return;
    }
    fetch("/api/android/latest")
      .then((r) => r.json())
      .then((d: { version: number | null }) => setLatest(d.version))
      .catch(() => undefined);
  }, []);

  if (mine === null) return null;
  if (latest !== null && latest > mine) {
    return (
      <div className="space-y-3 rounded-xl border border-ember/30 bg-ember/5 p-4">
        <p className="font-semibold">Update available — version 1.0.{latest}</p>
        <p className="text-sm text-ink/70">You have version 1.0.{mine}. The update installs over this one; you stay signed in.</p>
        <a href={ANDROID_APK_URL} className="btn-primary" download>
          <Download aria-hidden className="h-4 w-4" /> Download the update
        </a>
        <p className="hint">When it has downloaded, open <strong>grace.apk</strong> and tap <strong>Update</strong> (or Install).</p>
      </div>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink/80">
      <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
      Android app version 1.0.{mine}{latest !== null ? " — the newest" : ""}.
    </p>
  );
}
