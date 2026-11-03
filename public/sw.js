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
//      when opening a page fails outright (no connection) and there's no
//      saved copy of it.
//   5. /bible (the reader without signing in) and /login: no personal data,
//      network-first, kept even after sign-out, so a downloaded Bible can
//      be read signed out and offline. Also kept after sign-out: the app's
//      content-hashed scripts and styles (app-static-v1).
//   6. A few read-only church pages — Home, Announcements, Calendar, Songs,
//      Sermons — network-first, keeping the last copy of each one opened
//      (at most MAX_SAVED_PAGES), so they can be read offline. Nothing
//      private (chats, prayers, journal, members, giving, account…) is ever
//      saved. Saved copies are deleted on sign-out, like the Bible pages.
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
const PAGES_CACHE = "app-pages-v1"; // must match lib/bible/offline.ts and public/offline.html
// Not personal, so kept after sign-out: the public /bible reader page and the
// app's content-hashed scripts and styles (which every saved page needs).
const PUBLIC_CACHE = "app-public-v1"; // must match lib/bible/offline.ts
const STATIC_CACHE = "app-static-v1"; // must match lib/bible/offline.ts
const OFFLINE_URL = "/offline.html";
const KEEP = [TEXT_CACHE, SHELL_CACHE, OFFLINE_CACHE, PAGES_CACHE, PUBLIC_CACHE, STATIC_CACHE];
// Read-only church pages kept for offline reading once opened (and the pages under them, e.g. one song).
const SAVED_PAGES = ["/dashboard/announcements", "/dashboard/calendar", "/dashboard/songs", "/dashboard/sermons"];
const MAX_SAVED_PAGES = 40;

function isSavedPage(pathname) {
  if (/\/(new|edit)(\/|$)/.test(pathname)) return false; // forms need a connection anyway
  return pathname === "/dashboard" || SAVED_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
const OFFLINE_PAGES = ["/dashboard/bible/read", "/dashboard/bible/search"];
const MAX_STATIC_ENTRIES = 400;
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
    event.waitUntil(Promise.all([caches.delete(SHELL_CACHE), caches.delete(PAGES_CACHE)]));
    return;
  }

  if (url.pathname.startsWith("/bibles/")) {
    event.respondWith(cacheFirst(request, TEXT_CACHE));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticFile(request));
    return;
  }

  // The public Bible reader and the sign-in page: no personal data, so they
  // work signed out and offline (sign-in says it needs a connection and
  // points to the Bible).
  if (request.mode === "navigate" && (url.pathname === "/bible" || url.pathname === "/login")) {
    event.respondWith(networkFirstPage(request, url.pathname, PUBLIC_CACHE));
    return;
  }

  if (request.mode === "navigate" && OFFLINE_PAGES.includes(url.pathname)) {
    event.respondWith(networkFirstPage(request, url.pathname));
    return;
  }

  if (request.mode === "navigate" && isSavedPage(url.pathname)) {
    event.respondWith(networkFirstSaved(request, url.pathname + url.search));
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

/** Scripts and styles: from the kept copy (older workers kept them with the reader pages). */
async function staticFile(request) {
  const old = await caches.match(request, { cacheName: SHELL_CACHE, ignoreSearch: true });
  return old || cacheFirst(request, STATIC_CACHE, true);
}

/** The live page when online; the saved copy when offline or the network hangs. */
async function networkFirstPage(request, pathname, cacheName = SHELL_CACHE) {
  const cache = await caches.open(cacheName);
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

/**
 * A read-only church page: live when online (keeping a copy), the last copy
 * when offline. Unlike the Bible reader there's no time limit — a slow
 * connection still gets the live page, never an old copy.
 */
async function networkFirstSaved(request, key) {
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      const cache = await caches.open(PAGES_CACHE);
      await cache.delete(key);
      await cache.put(key, response.clone());
      const keys = await cache.keys();
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_SAVED_PAGES))) await cache.delete(old);
    }
    return response;
  } catch (error) {
    const saved = await caches.match(key, { cacheName: PAGES_CACHE });
    return saved || offlinePage();
  }
}

async function trimStatic(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith("/_next/static/"));
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(old);
}

// ---------------------------------------------------------------------------
// Phone pop-ups (Web Push) for the notification bell — sent by lib/push.ts.
// The payload is { title, body, url, tag }. Only in-app links are followed.
// The app icon: the Grace cross (scripts/build-brand.mjs).
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
  // An incoming video call stays on screen until answered or dismissed, with
  // a long ring-like vibration (Android; iPhones use their notification sound).
  const call = data.call === true;
  // A chat message gets WhatsApp's "Mark as read" button.
  const message = typeof data.notificationId === "string";
  // The unread count on the app icon, where the phone supports it (installed
  // app on iPhone, Android launchers that show numbers, computers).
  if (typeof data.badge === "number" && self.navigator.setAppBadge) {
    (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {});
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Grace", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      // Same tag (e.g. one chat) replaces the older pop-up instead of stacking.
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: safeUrl(data.url), notificationId: message ? data.notificationId : null },
      ...(message && !call ? { actions: [{ action: "read", title: "Mark as read" }] } : {}),
      ...(call
        ? {
            requireInteraction: true,
            vibrate: [700, 300, 700, 300, 700, 300, 700, 300, 700, 300, 700],
            // Like WhatsApp's incoming call pop-up.
            actions: [
              { action: "decline", title: "Decline" },
              { action: "answer", title: "Answer" },
            ],
          }
        : {}),
    }),
  );
});

// Tapping a pop-up: reuse an open app window if there is one, otherwise open it.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  // Incoming call: Decline tells the caller (signed-in cookie), Answer goes straight into the call.
  const callMatch = /^\/dashboard\/calls\/([0-9a-f-]{36})/.exec(safeUrl(event.notification.data && event.notification.data.url));
  if (callMatch && event.action === "decline") {
    event.waitUntil(
      fetch("/api/calls/decline", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ callId: callMatch[1] }) }).catch(() => {}),
    );
    return;
  }
  // "Mark as read": tell the app (signed-in cookie), update the icon badge, don't open anything.
  if (event.action === "read") {
    const id = event.notification.data && event.notification.data.notificationId;
    if (typeof id !== "string") return;
    event.waitUntil(
      fetch("/api/notifications/read", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body && typeof body.unread === "number" && self.navigator.setAppBadge) {
            return body.unread > 0 ? self.navigator.setAppBadge(body.unread) : self.navigator.clearAppBadge();
          }
        })
        .catch(() => {}),
    );
    return;
  }
  let url = safeUrl(event.notification.data && event.notification.data.url);
  if (callMatch && event.action === "answer") url = `/dashboard/calls/${callMatch[1]}?go=1`;
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
