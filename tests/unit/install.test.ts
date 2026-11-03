import { describe, expect, test } from "vitest";
import { detectPlatform, installMode, isInAppBrowser } from "@/lib/install";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36";
const FACEBOOK_IOS = `${IPHONE_SAFARI} [FBAN/FBIOS;FBAV/470.0.0]`;
const WINDOWS_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("detectPlatform", () => {
  test("iPhone, and an iPad that reports itself as a Mac", () => {
    expect(detectPlatform(IPHONE_SAFARI)).toBe("ios");
    expect(detectPlatform(IPAD_AS_MAC, 5)).toBe("ios");
  });
  test("a real Mac (no touch) is desktop; Android is android", () => {
    expect(detectPlatform(IPAD_AS_MAC, 0)).toBe("desktop");
    expect(detectPlatform(ANDROID_CHROME)).toBe("android");
    expect(detectPlatform(WINDOWS_CHROME)).toBe("desktop");
  });
});

describe("isInAppBrowser", () => {
  test("spots Facebook's browser and Android WebViews, not real browsers", () => {
    expect(isInAppBrowser(FACEBOOK_IOS)).toBe(true);
    expect(isInAppBrowser(ANDROID_WEBVIEW)).toBe(true);
    expect(isInAppBrowser(IPHONE_SAFARI)).toBe(false);
    expect(isInAppBrowser(ANDROID_CHROME)).toBe(false);
  });
});

describe("installMode", () => {
  const base = { standalone: false, hasPrompt: false, platform: "desktop" as "desktop" | "android" | "ios", inAppBrowser: false };
  test("already installed wins over everything", () => {
    expect(installMode({ ...base, standalone: true, hasPrompt: true })).toBe("installed");
    expect(installMode({ ...base, platform: "android", nativeApp: true })).toBe("installed");
  });
  test("Android phones get the Android app, even from the older home-screen version", () => {
    expect(installMode({ ...base, platform: "android", hasPrompt: true })).toBe("android-app");
    expect(installMode({ ...base, platform: "android", standalone: true })).toBe("android-app");
    expect(installMode({ ...base, platform: "android", inAppBrowser: true })).toBe("in-app");
  });
  test("in-app browsers are told to open a real browser, even if a prompt exists", () => {
    expect(installMode({ ...base, inAppBrowser: true, hasPrompt: true })).toBe("in-app");
  });
  test("the browser's own prompt when offered; iPhone steps; otherwise the browser menu", () => {
    expect(installMode({ ...base, hasPrompt: true })).toBe("prompt");
    expect(installMode({ ...base, platform: "ios" })).toBe("ios");
    expect(installMode(base)).toBe("manual");
  });
});
