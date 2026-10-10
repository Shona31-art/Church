"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { flash } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { MAX_MESSAGE_LENGTH, MUTE_OPTIONS, muteUntil, type MuteOption } from "@/lib/chat";
import { revalidatePath } from "next/cache";

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
    flash(
      /isn't accepting/.test(error?.message ?? "")
        ? "This person isn't accepting new direct messages."
        : /can't message/.test(error?.message ?? "")
        ? "You can't message this person."
        : "Couldn't start that conversation. They may no longer be in your church.",
      "error"
    );
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

// ---------------------------------------------------------------------------
// Per-chat settings (only ever your own — RLS on chat_member_settings)
// ---------------------------------------------------------------------------

async function requireChatUser() {
  const me = await getCurrentAppUser();
  if (!me) return null;
  return (await checkModuleAccess("dept_chats")).allowed ? me : null;
}

async function saveMySettings(channelId: string, values: Record<string, string | null>): Promise<ChatActionResult> {
  const me = await requireChatUser();
  if (!me) return { error: "Your session has expired — sign in again." };
  if (!z.string().uuid().safeParse(channelId).success) return { error: "That chat couldn't be found." };

  const { error } = await createClient()
    .from("chat_member_settings")
    .upsert({ channel_id: channelId, user_id: me.id, ...values }, { onConflict: "channel_id,user_id" });
  if (error) {
    console.error("[chat] settings save failed:", error.message);
    return { error: "Couldn't save that setting — please try again." };
  }
  revalidatePath("/dashboard/chat");
  return {};
}

/** Input: channel id, mute choice ("8h" | "1w" | "always") or null to unmute. */
export async function setChatMute(channelId: string, option: MuteOption | null): Promise<ChatActionResult> {
  if (option !== null && !MUTE_OPTIONS.some((o) => o.value === option)) return { error: "Choose how long to mute for." };
  return saveMySettings(channelId, { muted_until: option ? muteUntil(option) : null });
}

/** Input: channel id, pinned true/false. Pinned chats sit at the top of your list. */
export async function setChatPinned(channelId: string, pinned: boolean): Promise<ChatActionResult> {
  return saveMySettings(channelId, { pinned_at: pinned ? new Date().toISOString() : null });
}

/** Input: channel id. Hides everything sent before now — for you only; nobody else's copy changes. */
export async function clearMyChatHistory(channelId: string): Promise<ChatActionResult> {
  const result = await saveMySettings(channelId, { cleared_at: new Date().toISOString() });
  if (!result.error) revalidatePath(`/dashboard/chat/${channelId}`);
  return result;
}

// ---------------------------------------------------------------------------
// Blocking (the blocked person is never told)
// ---------------------------------------------------------------------------

/** Input: the other person's user id. Stops DMs both ways, including from pastors. */
export async function blockMember(userId: string): Promise<ChatActionResult> {
  const me = await requireChatUser();
  if (!me) return { error: "Your session has expired — sign in again." };
  const target = z.string().uuid().safeParse(userId);
  if (!target.success || target.data === me.id) return { error: "That person couldn't be found." };

  const { error } = await createClient().from("chat_blocks").upsert({ blocker_id: me.id, blocked_id: target.data }, { onConflict: "blocker_id,blocked_id" });
  if (error) {
    console.error("[chat] block failed:", error.message);
    return { error: "Couldn't block this person — please try again." };
  }
  revalidatePath("/dashboard/chat", "layout");
  revalidatePath("/dashboard/account");
  return {};
}

/** Input: the other person's user id. */
export async function unblockMember(userId: string): Promise<ChatActionResult> {
  const me = await requireChatUser();
  if (!me) return { error: "Your session has expired — sign in again." };
  const target = z.string().uuid().safeParse(userId);
  if (!target.success) return { error: "That person couldn't be found." };

  const { error } = await createClient().from("chat_blocks").delete().eq("blocker_id", me.id).eq("blocked_id", target.data);
  if (error) {
    console.error("[chat] unblock failed:", error.message);
    return { error: "Couldn't unblock this person — please try again." };
  }
  revalidatePath("/dashboard/chat", "layout");
  revalidatePath("/dashboard/account");
  return {};
}
