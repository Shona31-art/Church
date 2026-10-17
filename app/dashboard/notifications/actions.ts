"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { flash } from "@/lib/flash";
import { NOTIFICATION_COLUMNS, toNotificationItem, type NotificationItem } from "@/lib/notifications";

// Bell and notifications page. Every action re-checks the session; RLS
// (owner-only, notifications.sql) guarantees nobody touches anyone else's
// notifications, and marking read goes through mark_notifications_read().

type Result<T> = { ok: true; data: T } | { ok: false; error: string; signedOut?: boolean };
const SIGNED_OUT = { ok: false as const, error: "Your session has expired. Sign in again to see notifications.", signedOut: true };

/** Output: { unread: number, items: latest 15 }. For the bell's badge and panel. */
export async function getNotificationsSummary(): Promise<Result<{ unread: number; items: NotificationItem[] }>> {
  const me = await getCurrentAppUser();
  if (!me) return SIGNED_OUT;
  const supabase = createClient();
  const [unread, recent] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me.id).is("read_at", null),
    supabase.from("notifications").select(NOTIFICATION_COLUMNS).eq("user_id", me.id).order("updated_at", { ascending: false }).limit(15),
  ]);
  const error = unread.error ?? recent.error;
  if (error) {
    console.error("[notifications] summary failed:", error.message);
    return { ok: false, error: "Couldn't load notifications. Try again." };
  }
  return { ok: true, data: { unread: unread.count ?? 0, items: (recent.data ?? []).map(toNotificationItem) } };
}

/** Input: notification ids, or null for all of mine. Marks them read. */
export async function markNotificationsRead(ids: string[] | null): Promise<Result<undefined>> {
  const me = await getCurrentAppUser();
  if (!me) return SIGNED_OUT;
  const parsed = z.array(z.string().uuid()).max(100).nullable().safeParse(ids);
  if (!parsed.success) return { ok: false, error: "That didn't look right. Refresh and try again." };

  const { error } = await createClient().rpc("mark_notifications_read", { target_ids: parsed.data });
  if (error) {
    console.error("[notifications] mark read failed:", error.message);
    return { ok: false, error: "Couldn't mark that as read. Try again." };
  }
  revalidatePath("/dashboard/notifications");
  return { ok: true, data: undefined };
}

/** Form action (notifications page): mark everything read. */
export async function markAllReadAction(): Promise<void> {
  const res = await markNotificationsRead(null);
  flash(res.ok ? "All notifications marked as read." : res.error, res.ok ? "success" : "error");
}

/** Form action (notifications page, after confirmation): delete my read notifications. */
export async function clearReadAction(): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me) return flash(SIGNED_OUT.error, "error");
  const { error } = await createClient().from("notifications").delete().eq("user_id", me.id).not("read_at", "is", null);
  if (error) {
    console.error("[notifications] clear failed:", error.message);
    return flash("Couldn't clear notifications. Try again.", "error");
  }
  revalidatePath("/dashboard/notifications");
  flash("Read notifications cleared.");
}
