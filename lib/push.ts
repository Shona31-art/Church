import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNotificationLink, type NotificationCategory } from "@/lib/notifications";

// Phone pop-ups (Web Push) for the notification bell. Sends straight to each
// browser's push service (Google, Apple, Mozilla) with our own VAPID keys —
// no third-party notification service. Payloads are encrypted end to end by
// the Web Push standard, and carry only a title, short text and in-app link.
// Decision record: docs/adr/0002-notifications.md

const PREFERENCE_COLUMN: Record<NotificationCategory, string> = {
  church_news: "push_church_news",
  messages: "push_messages",
  prayer_care: "push_prayer_care",
  alerts: "push_alerts",
};

const SEND_TIMEOUT_MS = 8000;
let configured: boolean | null = null;

/** True when the three VAPID variables are set (see .env.example). */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  configured = Boolean(publicKey && privateKey && subject);
  if (configured) webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  return configured;
}

export interface PushMessage {
  title: string;
  body: string | null;
  link: string | null;
  /** Same tag replaces an older pop-up instead of stacking (e.g. one per chat). */
  tag?: string;
  /** An incoming video call: delivered fast or not at all, and shown as a call (sw.js). */
  call?: boolean;
  /** A chat message: the pop-up gets a "Mark as read" button (sw.js), which needs the notification's id. */
  messageId?: string;
  /** Unread total for the app icon's badge (where the phone supports it). */
  badge?: number;
}

/**
 * Sends a pop-up to every device the person turned pop-ups on for, if they
 * want this category as pop-ups. Never throws: failures are logged, and
 * devices the push service says are gone (404/410) are forgotten.
 * Returns how many devices accepted it.
 */
export async function sendPushToUser(userId: string, category: NotificationCategory | null, message: PushMessage): Promise<number> {
  if (!pushConfigured()) return 0;
  const admin = createAdminClient(); // server only: reads one person's devices and preferences

  if (category) {
    const { data: prefs, error } = await admin.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
    if (error) console.error("[push] preferences lookup failed:", error.message);
    // No row = defaults, which are all on.
    if (prefs && (prefs as Record<string, unknown>)[PREFERENCE_COLUMN[category]] === false) return 0;
  }

  const { data: devices, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (error) {
    console.error("[push] device lookup failed:", error.message);
    return 0;
  }

  const payload = JSON.stringify({
    title: message.title,
    body: message.body ?? "",
    url: safeNotificationLink(message.link),
    tag: message.tag,
    ...(message.call ? { call: true } : {}),
    ...(message.messageId ? { notificationId: message.messageId } : {}),
    ...(typeof message.badge === "number" ? { badge: message.badge } : {}),
  });

  const results = await Promise.all(
    (devices ?? []).map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
          // A call is only worth ringing for a minute; anything else, within a day.
          TTL: message.call ? 60 : 60 * 60 * 24,
          ...(message.call ? { urgency: "high" as const } : {}),
          timeout: SEND_TIMEOUT_MS,
        });
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", d.id);
        return true;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser unsubscribed or the app was uninstalled: stop trying.
          await admin.from("push_subscriptions").delete().eq("id", d.id);
        } else {
          console.error(`[push] send failed (${status ?? "network"}):`, (err as Error).message);
        }
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}

/** How many unread bell items someone has: the number on the app icon. */
export async function unreadCountFor(userId: string): Promise<number | undefined> {
  const { count, error } = await createAdminClient().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  if (error) {
    console.error("[push] unread count failed:", error.message);
    return undefined;
  }
  return count ?? 0;
}
