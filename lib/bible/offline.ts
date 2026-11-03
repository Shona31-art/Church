import { BOOKS, bookFileUrl } from "./books";

// Browser-side offline downloads: saves a whole version's 66 book files into
// the Cache Storage that the service worker (public/sw.js) reads from, so the
// reader and search work with no connection. Uses the Cache API directly, so
// a download works even before the service worker has taken control.

export const TEXT_CACHE = "bible-text-v1"; // must match public/sw.js
const SHELL_CACHE = "bible-shell-v1"; // must match public/sw.js
const PAGES_CACHE = "app-pages-v1"; // must match public/sw.js
const PUBLIC_CACHE = "app-public-v1"; // must match public/sw.js
const STATIC_CACHE = "app-static-v1"; // must match public/sw.js
/** The pages that must be saved for reading with no connection (public/sw.js OFFLINE_PAGES). */
const READER_PAGES = ["/dashboard/bible/read", "/dashboard/bible/search"];
/** The reader that works signed out (app/bible/page.tsx): kept even after sign-out. */
const PUBLIC_READER = "/bible";

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
  await saveReaderPages();
}

/**
 * Saves the reader and search pages, and every script and style they use,
 * so the downloaded Bible opens with no connection — even if the service
 * worker wasn't running yet when they were last opened (first visit, or
 * just after installing the app). Best effort: the text is what matters most,
 * and the pages are saved again whenever they're opened online.
 */
export async function saveReaderPages(): Promise<void> {
  if (!offlineSupported()) return;
  try {
    const [cache, publicCache, staticCache] = await Promise.all([caches.open(SHELL_CACHE), caches.open(PUBLIC_CACHE), caches.open(STATIC_CACHE)]);
    const assets = new Set<string>();
    // What this page has already loaded (the reader shares most of it).
    for (const entry of performance.getEntriesByType("resource")) {
      const url = new URL(entry.name, location.origin);
      if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) assets.add(url.pathname + url.search);
    }
    for (const page of [...READER_PAGES, PUBLIC_READER]) {
      const res = await fetch(page, { credentials: page === PUBLIC_READER ? "omit" : "same-origin", cache: "no-store" });
      if (!res.ok || res.redirected) continue; // signed out, or an error: nothing worth keeping
      const html = await res.clone().text();
      // Scripts and styles in the page, and the ones it loads later (named in its data).
      for (const m of html.matchAll(/\/?_next\/static\/[^"'\\\s)]+/g)) assets.add(("/" + m[0].replace(/^\//, "")).replace(/&amp;/g, "&"));
      for (const m of html.matchAll(/(?<![\w/])static\/(?:chunks|css|media)\/[^"'\\\s)]+/g)) assets.add("/_next/" + m[0]);
      await (page === PUBLIC_READER ? publicCache : cache).put(new URL(page, location.origin).href, res);
    }
    await Promise.all(
      [...assets].map(async (path) => {
        if ((await staticCache.match(path, { ignoreSearch: true })) || (await cache.match(path, { ignoreSearch: true }))) return;
        const res = await fetch(path).catch(() => null);
        if (res?.ok) await staticCache.put(path, res);
      })
    );
  } catch {
    // Saved next time the reader is opened online.
  }
}

export async function removeVersion(versionId: string): Promise<void> {
  const cache = await caches.open(TEXT_CACHE);
  const prefix = `/bibles/${versionId}/`;
  await Promise.all((await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith(prefix)).map((r) => cache.delete(r)));
}

/** On sign-out: forget the saved pages (they show the member's name and church news). Bible text stays. */
export async function clearOfflinePages(): Promise<void> {
  if (!offlineSupported()) return;
  try {
    await Promise.all([caches.delete(SHELL_CACHE), caches.delete(PAGES_CACHE)]);
  } catch {
    // nothing saved, or storage blocked
  }
}
