import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/read — the "Mark as read" button on a message
 * pop-up (public/sw.js). Signed-in person only (their session cookie); marks
 * that notification read and, for a chat, the chat itself (so its unread
 * count clears too), like WhatsApp's "Mark as read".
 *
 * Request:  JSON { id: notification id }
 * Response: 200 { unread } (for the app icon badge) · 401 signed out · 400 bad input
 */
const Body = z.object({ id: z.string().uuid() });
const CHAT_LINK = /^\/dashboard\/chat\/([0-9a-f-]{36})$/;

export async function POST(request: Request) {
  // JSON only: a plain cross-site form can't send this, so other sites can't trigger it.
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected a notification id." }, { status: 400 });

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // RLS: only your own notifications are visible.
  const { data: item } = await supabase.from("notifications").select("id, link").eq("id", parsed.data.id).maybeSingle();
  if (item) {
    const chat = item.link ? CHAT_LINK.exec(item.link) : null;
    const { error } = chat
      ? await supabase.rpc("mark_chat_read", { target_channel: chat[1] }) // also clears the bell item (on_chat_read)
      : await supabase.rpc("mark_notifications_read", { target_ids: [item.id] });
    if (error) console.error("[notifications] mark read from pop-up failed:", error.message);
  }
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).is("read_at", null);
  return NextResponse.json({ unread: count ?? 0 });
}
