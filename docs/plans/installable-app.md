# Installable app (PWA) — plan

Status: **BUILT** (2026-10-19) except icons, which wait for the real logo.

## Starting point

- `app/manifest.ts` existed (name, start URL `/dashboard`, standalone,
  colours) with **no icons**.
- `public/sw.js` existed: offline Bible text + reader pages, hashed static
  files, push pop-ups. Registered in production from the dashboard layout.
- Middleware already lets the manifest, `sw.js` and image files through
  without a session.
- No git remote / no deployment, so nothing can be installed on a phone yet
  (installing needs HTTPS).

## Decisions (user, 2026-10-19: "build everything else")

- Icon: deferred until the logo arrives. No placeholder icon is shipped.
- Install entry points: an "Install the app" section on My Account (always),
  plus a dismissible banner on the dashboard home on phones only, shown only
  when there's a real action to offer. Dismissal is remembered per device.
- Offline: one static page (`public/offline.html`) for dashboard pages
  opened with no connection. No member data is cached.
- Updates: pages always come from the network and only content-hashed files
  are cached, so no one is stuck on an old version. A toast says when a new
  version took over mid-session.

## What the install button does (never claims success it can't see)

| Situation | Shows |
|---|---|
| Already running as an installed app | "Installed" — nothing to do |
| Browser offered its install prompt (`beforeinstallprompt`: Chrome/Edge/Samsung on Android, desktop Chrome/Edge) | **Install** button → the browser's own prompt. "Installed" only after the browser fires `appinstalled` |
| iPhone/iPad | Steps: Share → Add to Home Screen → Add (Safari; also Chrome/Edge on iOS 16.4+) |
| In-app browser (WhatsApp, Facebook, Instagram…) | "Open this page in Safari/Chrome first" — they can't install |
| Anything else (e.g. Firefox Android, or Chrome before icons exist) | Browser-menu steps (⋮ → Install app / Add to Home screen) |

Note: Chrome only offers its install prompt once the manifest has 192×192
and 512×512 icons. Until the logo arrives, Android users get the menu steps.

## Mobile comfort

- `viewport-fit=cover` + safe-area padding (home indicator, landscape notch)
  on the shell, popups, menu drawer and toasts.
- Inputs are 16px on phones so iPhone Safari doesn't zoom in on focus.
- `100dvh` heights (with `100vh` fallback) so the mobile address bar doesn't
  hide content; no double-tap zoom delay on buttons.
- Apple web-app metadata: standalone, title, status bar.
