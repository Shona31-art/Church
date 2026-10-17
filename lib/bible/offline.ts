import { BOOKS, bookFileUrl } from "./books";

// Browser-side offline downloads: saves a whole version's 66 book files into
// the Cache Storage that the service worker (public/sw.js) reads from, so the
// reader and search work with no connection. Uses the Cache API directly, so
// a download works even before the service worker has taken control.

export const TEXT_CACHE = "bible-text-v1"; // must match public/sw.js
const SHELL_CACHE = "bible-shell-v1"; // must match public/sw.js

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

export type DownloadStatus = { saved: number; total: number };

/** How many of a version's 66 books are saved on this device. */
export async function downloadStatus(versionId: string): Promise<DownloadStatus> {
  const total = BOOKS.length;
  if (!offlineSupported()) return { saved: 0, total };
  try {
    const cache = await caches.open(TEXT_CACHE);
    const prefix = `/bibles/${versionId}/`;
    const saved = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith(prefix)).length;
    return { saved: Math.min(saved, total), total };
  } catch {
    return { saved: 0, total };
  }
}

/**
 * Saves every book of a version (skipping ones already saved). Calls
 * onProgress after each book. Throws if any book fails, leaving the ones that
 * did download in place, so "Try again" only fetches the rest.
 */
export async function downloadVersion(versionId: string, onProgress: (status: DownloadStatus) => void, signal?: AbortSignal): Promise<void> {
  const cache = await caches.open(TEXT_CACHE);
  // Ask the browser not to clear this storage under pressure (granted silently
  // for installed apps on Android/Chrome; iOS may ignore it).
  navigator.storage?.persist?.().catch(() => undefined);

  let saved = 0;
  let failures = 0;
  for (let i = 0; i < BOOKS.length; i++) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const url = bookFileUrl(versionId, i);
    if (!(await cache.match(url))) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(String(res.status));
        await cache.put(url, res);
      } catch {
        failures++;
        continue;
      }
    }
    saved++;
    onProgress({ saved, total: BOOKS.length });
  }
  if (failures) throw new Error(`${failures} books didn't download`);
}

export async function removeVersion(versionId: string): Promise<void> {
  const cache = await caches.open(TEXT_CACHE);
  const prefix = `/bibles/${versionId}/`;
  await Promise.all((await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith(prefix)).map((r) => cache.delete(r)));
}

/** On sign-out: forget the saved reader pages (they show the member's name). Bible text stays. */
export async function clearOfflinePages(): Promise<void> {
  if (!offlineSupported()) return;
  try {
    await caches.delete(SHELL_CACHE);
  } catch {
    // nothing saved, or storage blocked
  }
}
