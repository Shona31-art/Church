"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { flash } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat";

/**
 * Opens (or reuses) a direct message with someone in the same church.
 * Form fields: user_id. The start_direct_message() database function checks
 * both people are active members of the caller's church and creates the
 * channel and memberships in one step (platform_hardening.sql).
 */
export async function startDirectMessage(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me) redirect("/login");
  if (!(await checkModuleAccess("dept_chats")).allowed) redirect("/dashboard/chat");

  const other = z.string().uuid().safeParse(formData.get("user_id"));
  if (!other.success || other.data === me.id) {
    flash("Choose someone to message.", "error");
    redirect("/dashboard/chat/dm/new");
  }

  const { data: channelId, error } = await createClient().rpc("start_direct_message", { other_user: other.data });
  if (error || !channelId) {
    console.error("[chat] start DM failed:", error?.message);
    flash("Couldn't start that conversation. They may no longer be in your church.", "error");
    redirect("/dashboard/chat/dm/new");
  }
  redirect(`/dashboard/chat/${channelId}`);
}

type ChatActionResult = { error?: string };

const CHAT_MEDIA_BUCKET = "chat-media";

/**
 * Edits your own text message. Input: message id, new text (1–4000 chars).
 * edit_chat_message() in the database re-checks ownership and the 15-minute
 * window, so a stale screen can't edit late.
 */
export async function editChatMessage(messageId: string, content: string): Promise<ChatActionResult> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again." };
  if (!(await checkModuleAccess("dept_chats")).allowed) return { error: "Chats aren't available on your church's plan." };

  const parsed = z
    .object({ id: z.string().uuid(), content: z.string().trim().min(1, "Type a message.").max(MAX_MESSAGE_LENGTH, "That message is too long.") })
    .safeParse({ id: messageId, content });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your message." };

  const { error } = await createClient().rpc("edit_chat_message", { target_message: parsed.data.id, new_content: parsed.data.content });
  if (error) {
    console.error("[chat] edit failed:", error.message);
    if (/15 minutes/.test(error.message)) return { error: "Messages can only be edited for 15 minutes after sending." };
    if (/own messages/.test(error.message)) return { error: "You can only edit your own messages." };
    return { error: "Couldn't save your edit — please try again." };
  }
  return {};
}

/**
 * Deletes a message for everyone (soft delete — it stays as "This message
 * was deleted"). Input: message id. Allowed for the sender, or a pastor/admin
 * in a group channel (never DMs) — enforced by delete_chat_message(). Any
 * attached file is removed from Storage, and a moderator removing someone
 * else's message is logged.
 */
export async function deleteChatMessage(messageId: string): Promise<ChatActionResult> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  if (!(await checkModuleAccess("dept_chats")).allowed) return { error: "Chats aren't available on your church's plan." };

  const id = z.string().uuid().safeParse(messageId);
  if (!id.success) return { error: "That message couldn't be found." };

  const supabase = createClient();
  // RLS: only returns the message if this person can see the conversation.
  const { data: message } = await supabase.from("chat_messages").select("id, sender_id, channel_id").eq("id", id.data).maybeSingle();
  if (!message) return { error: "That message couldn't be found." };

  let { data: filePath, error } = await supabase.rpc("delete_chat_message", { target_message: id.data });
  // Before chat_v2.sql is installed the function doesn't exist (PGRST202);
  // fall back to the original hard delete, which RLS still allows then.
  if (error?.code === "PGRST202") {
    const legacy = await supabase.from("chat_messages").delete({ count: "exact" }).eq("id", id.data);
    error = legacy.error ?? (legacy.count ? null : { message: "own messages" } as typeof error);
    filePath = null;
  }
  if (error) {
    console.error("[chat] delete failed:", error.message);
    return { error: /own messages/.test(error.message) ? "You can only delete your own messages." : "Couldn't delete that message — please try again." };
  }

  // The path came from the database and is always inside this church's
  // folder; checked anyway before using the service role.
  if (typeof filePath === "string" && filePath.startsWith(`${me.church_id}/`)) {
    const { error: fileError } = await createAdminClient().storage.from(CHAT_MEDIA_BUCKET).remove([filePath]);
    if (fileError) console.error("[chat] attached file not removed:", fileError.message);
  }

  if (message.sender_id !== me.id) {
    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: "chat.message_removed",
      targetTable: "chat_messages",
      targetId: message.id,
      metadata: { channel_id: message.channel_id, sender_id: message.sender_id },
    });
  }
  return {};
}
