"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { isOldAndroidApp, saveBlob } from "@/lib/save-file";
import { showToast } from "@/components/ui/Toaster";

/**
 * POPIA export: fetched with the signed-in session, then saved (a plain link
 * fails in the Android app, which hands downloads to a signed-out browser).
 */
export function DownloadDataButton({ memberId, label = "Download my data" }: { memberId: string; label?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* A readable PDF; the JSON copy is for moving the data to another system. */}
      <DownloadButton href={`/api/members/${memberId}/export`} label={label} fallbackName="grace-my-information.pdf" done="Saved — open it from your Downloads." />
      <DownloadButton href={`/api/members/${memberId}/export?format=json`} label="Machine-readable copy (JSON)" fallbackName="grace-data.json" done="Downloaded." className="btn-ghost btn-sm" />
    </span>
  );
}

/** Any file from the app's own API (exports, reports), downloaded with the signed-in session. */
export function DownloadButton({ href, label, fallbackName, done = "Downloaded.", className = "btn-secondary" }: { href: string; label: string; fallbackName: string; done?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) {
        const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
        showToast(msg ?? "Couldn't prepare the download — please try again.", "error");
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
      const ok = await saveBlob(await res.blob(), name);
      if (!ok) showToast(isOldAndroidApp() ? "Update the Grace app to save files (My account → Install the app), or open Grace in Chrome." : "Couldn't save the file.", "info");
      else showToast(done, "success");
    } catch {
      showToast("Couldn't download — check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className={className} onClick={run} disabled={busy} aria-busy={busy}>
      <Download aria-hidden className="h-4 w-4" /> {busy ? "Preparing…" : label}
    </button>
  );
}
