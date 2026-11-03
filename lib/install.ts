// Which "install the app" help to show on this device. Pure functions (no
// window access) so they're unit-tested in tests/unit/install.test.ts; the
// browser wiring is in components/install/install-store.ts.

export type InstallPlatform = "ios" | "android" | "desktop";

/**
 * What the Install UI should offer:
 *   installed — already running as the home-screen app
 *   prompt    — the browser handed us its install prompt (Android Chrome/Edge/Samsung, desktop Chrome/Edge)
 *   ios       — iPhone/iPad: Share → Add to Home Screen, done by hand
 *   in-app    — inside WhatsApp/Facebook/Instagram etc., which can't install: open in a real browser first
 *   manual    — no prompt available: use the browser's own menu
 *   android-app — Android phone: download Grace's Android app (/android), which
 *                 rings for calls like a phone. Also offered to people using the
 *                 older home-screen (browser) version, so they switch over.
 */
export type InstallMode = "installed" | "prompt" | "ios" | "in-app" | "manual" | "android-app";

export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** Browsers built into other apps. They have no "Add to Home Screen". */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|musical_ly|; wv\)/i.test(userAgent);
}

export function installMode(input: { standalone: boolean; hasPrompt: boolean; platform: InstallPlatform; inAppBrowser: boolean; nativeApp?: boolean }): InstallMode {
  if (input.nativeApp) return "installed";
  if (input.platform === "android" && !input.inAppBrowser) return "android-app";
  if (input.standalone) return "installed";
  if (input.inAppBrowser) return "in-app";
  if (input.hasPrompt) return "prompt";
  if (input.platform === "ios") return "ios";
  return "manual";
}
