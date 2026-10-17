"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { sendPushToUser, pushConfigured } from "@/lib/push";
import { CATEGORIES, type NotificationCategory } from "@/lib/notifications";

// My Account → Notifications: phone pop-ups on this device, and which kinds
// of notification become pop-ups. Writes go through RLS (own rows only) or
// save_push_subscription(), which re-checks who's signed in.

type Result = { ok: true } | { ok: false; error: string };
const SIGNED_OUT: Result = { ok: false, error: "Your session has expired. Sign in again, then retry." };

const Subscription = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Input: the browser's PushSubscription (JSON) and a short device description. Saves it for the signed-in person. */
export async function savePushSubscription(subscription: unknown, userAgent: string): Promise<Result> {
  const me = await getCurrentAppUser();
  if (!me) return SIGNED_OUT;
  const parsed = Subscription.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "This browser gave an unexpected subscription. Try again, or use another browser." };

  const { error } = await createClient().rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: userAgent.slice(0, 300),
  });
  if (error) {
    console.error("[push] save subscription failed:", error.message);
    return { ok: false, error: "Couldn't turn on pop-ups. Try again." };
  }
  return { ok: true };
}

/** Input: this device's push endpoint. Forgets it (own rows only, by RLS). */
export async function removePushSubscription(endpoint: string): Promise<Result> {
  const me = await getCurrentAppUser();
  if (!me) return SIGNED_OUT;
  const parsed = z.string().url().max(1000).safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "That didn't look right. Refresh and try again." };

  const { error } = await createClient().from("push_subscriptions").delete().eq("endpoint", parsed.data).eq("user_id", me.id);
  if (error) {
    console.error("[push] remove subscription failed:", error.message);
    return { ok: false, error: "Couldn't turn off pop-ups. Try again." };
  }
  return { ok: true };
}

/** Input: { category, enabled }. Turns pop-ups for one kind of notification on or off. */
export async function setPushPreference(category: NotificationCategory, enabled: boolean): Promise<Result> {
  const me = await getCurrentAppUser();
  if (!me) return SIGNED_OUT;
  const parsed = z.object({ category: z.enum(CATEGORIES), enabled: z.boolean() }).safeParse({ category, enabled });
  if (!parsed.success) return { ok: false, error: "That didn't look right. Refresh and try again." };

  const column = `push_${parsed.data.category}`;
  const { error } = await createClient()
    .from("notification_preferences")
    .upsert({ user_id: me.id, [column]: parsed.data.enabled }, { onConflict: "user_id" });
  if (error) {
    console.error("[push] save preference failed:", error.message);
    return { ok: false, error: "Couldn't save that setting. Try again." };
  }
  return { ok: true };
}

/** Sends a test pop-up to all of the signed-in person's devices (ignores category settings). */
export async function sendTestPush(): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const me = await getCurrentAppUser();
  if (!me) return SIGNED_OUT as { ok: false; error: string };
  if (!pushConfigured()) return { ok: false, error: "Pop-ups aren't set up on this server yet (missing VAPID keys)." };
  const sent = await sendPushToUser(me.id, null, {
    title: "Pop-ups are working",
    body: "You'll get notifications like this one on this device.",
    link: "/dashboard/notifications",
    tag: "test",
  });
  return sent
    ? { ok: true, sent }
    : { ok: false, error: "No device accepted the test. Turn pop-ups off and on again on this device, then retry." };
}
