import { afterEach, describe, expect, test, vi } from "vitest";

// The Android app's push payloads (lib/push.ts) and Firebase settings (lib/fcm.ts).
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { androidPayload } = await import("@/lib/push");
const { androidAppConfig, fcmConfigured } = await import("@/lib/fcm");

const CALL = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";

describe("androidPayload", () => {
  test("a call rings as a call, with who's calling and whether it's video", () => {
    expect(androidPayload({ title: "Alice", body: "Incoming video call", link: `/dashboard/calls/${CALL}`, call: true, badge: 3 })).toEqual({
      type: "call",
      callId: CALL,
      title: "Alice",
      video: "1",
      url: `/dashboard/calls/${CALL}`,
      badge: "3",
    });
    expect(androidPayload({ title: "Bob", body: "Incoming voice call", link: `/dashboard/calls/${CALL}`, call: true }).video).toBe("0");
  });

  test("a message pops up with its text, chat link and the unread number", () => {
    expect(androidPayload({ title: "Alice", body: "Hello", link: "/dashboard/chat/x", tag: "chat:x", messageId: "n1", badge: 5 })).toEqual({
      type: "notice",
      kind: "message",
      title: "Alice",
      body: "Hello",
      url: "/dashboard/chat/x",
      tag: "chat:x",
      badge: "5",
    });
  });

  test("only Grace's own pages are linked", () => {
    expect(androidPayload({ title: "x", body: null, link: "https://evil.example" }).url).toBe("/dashboard/notifications");
  });
});

describe("Firebase settings", () => {
  afterEach(() => {
    delete process.env.FIREBASE_ANDROID_APP;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  });

  const googleServices = {
    project_info: { project_number: "123456789", project_id: "grace-app" },
    client: [
      { client_info: { mobilesdk_app_id: "1:999:android:other", android_client_info: { package_name: "some.other.app" } }, api_key: [{ current_key: "other" }] },
      { client_info: { mobilesdk_app_id: "1:123456789:android:abc", android_client_info: { package_name: "stream.gracebound.grace" } }, api_key: [{ current_key: "AIzaKey" }] },
    ],
  };

  test("reads Grace's entry from google-services.json", () => {
    process.env.FIREBASE_ANDROID_APP = JSON.stringify(googleServices);
    expect(androidAppConfig()).toEqual({ appId: "1:123456789:android:abc", apiKey: "AIzaKey", projectId: "grace-app", senderId: "123456789" });
  });

  test("off until both variables are set and valid", () => {
    expect(fcmConfigured()).toBe(false);
    process.env.FIREBASE_ANDROID_APP = JSON.stringify(googleServices);
    expect(fcmConfigured()).toBe(false);
    process.env.FIREBASE_SERVICE_ACCOUNT = "not json";
    expect(fcmConfigured()).toBe(false);
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ client_email: "a@b", private_key: "k", project_id: "grace-app" });
    expect(fcmConfigured()).toBe(true);
  });
});
