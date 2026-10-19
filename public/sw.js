// Service worker: offline Bible reading. Plain JS (no build step) because the
// browser loads this file directly. Registered by components/ServiceWorker.tsx
// in production only. Decision record: docs/adr/0001-bible-text-hosting-and-offline.md
//
// Deliberately narrow — it only ever touches:
//   1. /bibles/*  public-domain text files. Cache-first; kept until the member
//                 removes a download (lib/bible/offline.ts writes the same cache).
//   2. The Bible reader and search pages: network-first, falling back to the
//      last copy when offline. These pages render no personal data beyond the
//      app's own header, and the copy is deleted on sign-out.
//   3. /_next/static/*  the immutable, content-hashed scripts/styles/fonts those
//      pages need. Cache-first, trimmed so it can't grow without limit.
//   4. /offline.html  a static, data-free page saved once at install. Shown
//      only when opening a page fails outright (no connection) — never
//      instead of a slow page, and no other page is ever cached.
// Everything else (other pages, server actions, Supabase, POSTs) goes straight
// to the network, untouched.
//
// Updates: this file is served with no-cache (next.config.js), so browsers
// pick up a new version on the next visit; it takes over at once
// (skipWaiting) and components/ServiceWorker.tsx tells the person to refresh.
//
// It also shows phone pop-ups for the notification bell (push and
// notificationclick handlers at the bottom of this file).
//
// Turning it off: replace this file's contents with a worker that deletes its
// caches and unregisters itself, and deploy.

const TEXT_CACHE = "bible-text-v1"; // must match lib/bible/offline.ts
const SHELL_CACHE = "bible-shell-v1";
const OFFLINE_CACHE = "app-offline-v1";
const OFFLINE_URL = "/offline.html";
const KEEP = [TEXT_CACHE, SHELL_CACHE, OFFLINE_CACHE];
const OFFLINE_PAGES = ["/dashboard/bible/read", "/dashboard/bible/search"];
const MAX_STATIC_ENTRIES = 200;
const NETWORK_TIMEOUT_MS = 6000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch (error) {
        // Installing while offline: carry on without the offline page rather
        // than failing the whole worker (Bible offline and pop-ups still work).
        console.warn("[sw] couldn't save the offline page:", error);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches from older versions of this worker.
      for (const key of await caches.keys()) {
        if ((key.startsWith("bible-") || key.startsWith("app-")) && !KEEP.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Signing out: forget the saved reader pages (they show the member's name in
  // the header). The Bible text itself isn't personal and stays.
  if (url.pathname.startsWith("/auth/signout")) {
    event.waitUntil(caches.delete(SHELL_CACHE));
    return;
  }

  if (url.pathname.startsWith("/bibles/")) {
    event.respondWith(cacheFirst(request, TEXT_CACHE));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE, true));
    return;
  }

  if (request.mode === "navigate" && OFFLINE_PAGES.includes(url.pathname)) {
    event.respondWith(networkFirstPage(request, url.pathname));
    return;
  }

  // Any other page: straight from the network, nothing stored. Only if the
  // request fails outright (offline) do we show the saved offline page.
  if (request.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(offlinePage));
  }
});

async function offlinePage() {
  const saved = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
  return saved || Response.error();
}

async function cacheFirst(request, cacheName, trim = false) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    if (trim) trimStatic(cache);
  }
  return response;
}

/** The live page when online; the saved copy when offline or the network hangs. */
async function networkFirstPage(request, pathname) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    // Only keep real pages: not redirects to /login (signed out) or errors.
    if (response.ok && !response.redirected) await cache.put(pathname, response.clone());
    return response;
  } catch (error) {
    // One saved copy per page, whatever passage it was saved on: the reader
    // reads the passage from the address bar, not from the saved HTML.
    const saved = await cache.match(pathname);
    if (saved) return saved;
    // Never opened online on this device: the offline page explains.
    return offlinePage();
  }
}

async function trimStatic(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith("/_next/static/"));
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(old);
}

// ---------------------------------------------------------------------------
// Phone pop-ups (Web Push) for the notification bell — sent by lib/push.ts.
// The payload is { title, body, url, tag }. Only in-app links are followed.
// BRAND PLACEHOLDER: no icon yet, so browsers show their default; add the
// logo as `icon` once it exists.
// ---------------------------------------------------------------------------

function safeUrl(url) {
  return typeof url === "string" && url.startsWith("/dashboard") && !url.startsWith("//") ? url : "/dashboard/notifications";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: show a generic pop-up rather than nothing.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Grace-bound", {
      body: data.body || "",
      // Same tag (e.g. one chat) replaces the older pop-up instead of stacking.
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: safeUrl(data.url) },
    }),
  );
});

// Tapping a pop-up: reuse an open app window if there is one, otherwise open it.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
