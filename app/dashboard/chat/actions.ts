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
import type { FormState } from "@/lib/forms";
import { can } from "@/lib/permissions";

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
    console.error("[chat] settings save failed:", error.code, error.message);
    // 42703 / PGRST204: a column from a later database update is missing.
    if (error.code === "42703" || error.code === "PGRST204" || /column/i.test(error.message)) {
      return { error: "This needs a database update: a church admin should run supabase/chat_v3.sql in the Supabase SQL Editor." };
    }
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
  return saveMySettings(channelId, { pinned_at: pinned === true ? new Date().toISOString() : null });
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

// ---------------------------------------------------------------------------
// Channels: create / edit (pastors & admins), delete (church admins)
// ---------------------------------------------------------------------------

/**
 * Form fields: channel_id (when editing), name, description?, audience
 * ("everyone" | "members"), member_ids (repeated). The database functions
 * re-check the caller's role and keep members inside the church.
 */
export async function saveChannel(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireChatUser();
  if (!me || !can(me.role, "manageChatChannels")) return { error: "Only pastors and church admins can manage channels." };

  const parsed = z
    .object({
      channelId: z.string().uuid().optional(),
      name: z.string().trim().min(2, "Give the channel a name (at least 2 characters).").max(60, "Keep the name to 60 characters."),
      description: z.string().trim().max(200, "Keep the description to 200 characters.").optional(),
      audience: z.enum(["everyone", "members"]),
      memberIds: z.array(z.string().uuid()).max(500),
    })
    .safeParse({
      channelId: formData.get("channel_id") || undefined,
      name: formData.get("name") ?? "",
      description: formData.get("description") || undefined,
      audience: formData.get("audience"),
      memberIds: formData.getAll("member_ids"),
    });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: "Please fix the highlighted field.", fieldErrors: { [String(issue.path[0] ?? "name")]: issue.message } };
  }
  const { channelId, name, description, audience, memberIds } = parsed.data;
  const onlyMembers = audience === "members";
  if (onlyMembers && memberIds.length === 0 && !channelId) return { error: "Choose at least one member, or make the channel open to everyone.", fieldErrors: { member_ids: "Choose at least one member." } };

  const supabase = createClient();
  let id = channelId;
  if (channelId) {
    const { error } = await supabase.rpc("update_chat_channel", { target_channel: channelId, channel_name: name, channel_description: description ?? null, only_members: onlyMembers, member_ids: memberIds });
    if (error) {
      console.error("[chat] update channel failed:", error.message);
      return { error: /Only/.test(error.message) ? "You can't change this channel." : "Couldn't save the channel — please try again." };
    }
  } else {
    const { data, error } = await supabase.rpc("create_chat_channel", { channel_name: name, channel_description: description ?? null, only_members: onlyMembers, member_ids: memberIds });
    if (error || !data) {
      console.error("[chat] create channel failed:", error?.message);
      return { error: error?.code === "PGRST202" ? "Channels need a database update first — ask your church admin to contact support." : "Couldn't create the channel — please try again." };
    }
    id = data as string;
  }

  await logAudit({ churchId: me.church_id, actorId: me.id, action: channelId ? "chat.channel_updated" : "chat.channel_created", targetTable: "chat_channels", targetId: id, metadata: { members_only: onlyMembers, member_count: memberIds.length } });
  revalidatePath("/dashboard/chat", "layout");
  flash(channelId ? "Channel saved." : "Channel created.");
  redirect(`/dashboard/chat/${id}`);
}

/** Removes a deleted conversation's voice notes / photos from Storage (service role; paths from the database). */
async function removeChatFiles(paths: unknown, churchId: string) {
  const own = (Array.isArray(paths) ? paths : []).filter((p): p is string => typeof p === "string" && p.startsWith(`${churchId}/`));
  if (!own.length) return;
  const { error } = await createAdminClient().storage.from(CHAT_MEDIA_BUCKET).remove(own);
  if (error) console.error("[chat] files not removed:", error.message);
}

/** Church admins: permanently delete a department or extra channel. Logged. */
export async function deleteChannel(channelId: string): Promise<ChatActionResult> {
  const me = await requireChatUser();
  if (!me?.church_id || !can(me.role, "deleteChatChannels")) return { error: "Only church admins can delete channels." };
  if (!z.string().uuid().safeParse(channelId).success) return { error: "That channel couldn't be found." };

  const { data: paths, error } = await createClient().rpc("delete_chat_channel", { target_channel: channelId });
  if (error) {
    console.error("[chat] delete channel failed:", error.message);
    return { error: /can't be deleted/.test(error.message) ? "The church-wide General channel can't be deleted." : "Couldn't delete the channel — please try again." };
  }
  await removeChatFiles(paths, me.church_id);
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "chat.channel_deleted", targetTable: "chat_channels", targetId: channelId });
  revalidatePath("/dashboard/chat", "layout");
  return {};
}

/**
 * Either person in a DM: delete it for both, permanently. Logged without any
 * message content (who deleted which conversation, and when).
 */
export async function deleteDirectMessageForBoth(channelId: string): Promise<ChatActionResult> {
  const me = await requireChatUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  if (!z.string().uuid().safeParse(channelId).success) return { error: "That conversation couldn't be found." };

  const { data: paths, error } = await createClient().rpc("delete_direct_message", { target_channel: channelId });
  if (error) {
    console.error("[chat] delete DM failed:", error.message);
    return { error: "Couldn't delete the conversation — please try again." };
  }
  await removeChatFiles(paths, me.church_id);
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "chat.dm_deleted", targetTable: "chat_channels", targetId: channelId });
  revalidatePath("/dashboard/chat", "layout");
  return {};
}

/** "Delete for me": hide the chat from my list and clear my copy. It comes back if a new message arrives. */
export async function hideChatForMe(channelId: string): Promise<ChatActionResult> {
  const now = new Date().toISOString();
  return saveMySettings(channelId, { hidden_at: now, cleared_at: now });
}

// ---------------------------------------------------------------------------
// Forwarding (chat_v4.sql adds the "Forwarded" label)
// ---------------------------------------------------------------------------

export interface ForwardTarget {
  id: string;
  name: string;
  isDm: boolean;
}

/** The chats you could forward to: every chat you can see, private ones by the other person's name. */
export async function listForwardTargets(): Promise<{ targets?: ForwardTarget[]; error?: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  const supabase = createClient();
  // RLS: only chats this person can see.
  const { data: channels, error } = await supabase.from("chat_channels").select("id, name, is_dm").eq("church_id", me.church_id);
  if (error) return { error: "Couldn't load your chats — try again." };
  const dmIds = (channels ?? []).filter((c) => c.is_dm).map((c) => c.id);
  const { data: others } = dmIds.length
    ? await supabase.from("chat_channel_members").select("channel_id, app_users(name)").in("channel_id", dmIds).neq("user_id", me.id)
    : { data: [] };
  const dmName = new Map(((others ?? []) as any[]).map((o) => [o.channel_id as string, (o.app_users?.name as string) ?? "Former member"]));
  const targets = (channels ?? [])
    .map((c) => ({ id: c.id, name: c.is_dm ? dmName.get(c.id) ?? "Former member" : c.name, isDm: c.is_dm }))
    .sort((a, b) => Number(a.isDm) - Number(b.isDm) || a.name.localeCompare(b.name));
  return { targets };
}

const FORWARD_LIMIT = 5;

/**
 * Forward a message to up to 5 chats, like WhatsApp. Text, photos and voice
 * notes (the file is copied into each chat, so it stays if the original is
 * deleted). Each copy is posted as you, under the usual posting rules — a
 * chat you can't post in (or that doesn't allow photos) is skipped.
 */
export async function forwardMessage(messageId: string, targetIds: string[]): Promise<{ sent?: number; error?: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again." };
  const parsed = z.object({ messageId: z.string().uuid(), targets: z.array(z.string().uuid()).min(1, "Choose a chat.").max(FORWARD_LIMIT, `Forward to up to ${FORWARD_LIMIT} chats at a time.`) }).safeParse({ messageId, targets: targetIds });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a chat." };

  const supabase = createClient();
  // RLS: you can only forward what you can read.
  const { data: source } = await supabase
    .from("chat_messages")
    .select("id, channel_id, content, kind, media_path, media_duration_ms, deleted_at, media_expired_at")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (!source || source.deleted_at) return { error: "That message is no longer available." };
  if (source.kind === "poll") return { error: "Polls can't be forwarded." };
  if (source.kind !== "text" && (!source.media_path || source.media_expired_at)) return { error: "That file has expired, so it can't be forwarded." };

  const admin = createAdminClient();
  let sent = 0;
  for (const target of [...new Set(parsed.data.targets)]) {
    let path: string | null = null;
    if (source.media_path) {
      const ext = source.media_path.split(".").pop() ?? "bin";
      path = `${me.church_id}/${target}/${me.id}/${crypto.randomUUID()}.${ext}`;
      const { error: copyError } = await admin.storage.from(CHAT_MEDIA_BUCKET).copy(source.media_path, path);
      if (copyError) {
        console.error("[chat] forward copy failed:", copyError.message);
        continue;
      }
    }
    const { error } = await supabase.from("chat_messages").insert({
      channel_id: target,
      sender_id: me.id,
      content: source.content,
      kind: source.kind,
      media_path: path,
      media_duration_ms: source.media_duration_ms,
      forwarded: true,
    });
    if (error) {
      if (path) await admin.storage.from(CHAT_MEDIA_BUCKET).remove([path]);
      continue;
    }
    sent++;
  }
  if (!sent) return { error: "Couldn't forward to those chats — you may not be able to post there." };
  return { sent };
}

// ---------------------------------------------------------------------------
// Archive and disappearing messages (chat_v4.sql)
// ---------------------------------------------------------------------------

/** Archive (or unarchive) a chat — for you only. It moves to "Archived" at the bottom of your list. */
export async function setChatArchived(channelId: string, archived: boolean): Promise<ChatActionResult> {
  if (typeof archived !== "boolean") return { error: "That didn't look right — refresh and try again." };
  const result = await saveMySettings(channelId, { archived_at: archived ? new Date().toISOString() : null });
  return result.error?.includes("chat_v3") ? { error: "Archiving needs a database update: run supabase/chat_v4.sql." } : result;
}

/** Disappearing messages: 24 hours, 7 days, 90 days, or off (null). The database decides who may change it. */
export async function setChatDisappearing(channelId: string, seconds: number | null): Promise<ChatActionResult> {
  const me = await requireChatUser();
  if (!me) return { error: "Your session has expired — sign in again." };
  if (!z.string().uuid().safeParse(channelId).success) return { error: "That chat couldn't be found." };
  if (seconds !== null && ![86400, 604800, 7776000].includes(seconds)) return { error: "Choose 24 hours, 7 days or 90 days." };
  const { error } = await createClient().rpc("set_chat_disappearing", { target_channel: channelId, seconds });
  if (error) {
    console.error("[chat] disappearing setting failed:", error.message);
    if (/pastors and church admins/.test(error.message)) return { error: "In group chats, only pastors and church admins can change this." };
    if (/function|does not exist/i.test(error.message)) return { error: "This needs a database update: run supabase/chat_v4.sql." };
    return { error: "Couldn't change that — please try again." };
  }
  revalidatePath(`/dashboard/chat/${channelId}`);
  return {};
}
