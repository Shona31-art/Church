"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { isOwnAttachmentPath } from "@/lib/support";
import { replySchema, ticketStatusSchema } from "@/lib/support-schemas";

export type FormResult = { error?: string; ok?: boolean } | null;

/**
 * Adds a reply to a ticket. Form fields: ticket_id, content, attachment_path?
 * RLS decides who may reply (creator, their church admin, support staff).
 */
export async function replyToTicket(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again. Your reply is still in the box." };

  const parsed = replySchema.safeParse({
    ticketId: formData.get("ticket_id"),
    content: formData.get("content"),
    attachmentPath: formData.get("attachment_path") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your reply." };
  const { ticketId, content, attachmentPath } = parsed.data;
  if (attachmentPath && !isOwnAttachmentPath(attachmentPath, me.id)) {
    return { error: "That attachment couldn't be used — please upload it again." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    sender_id: me.id,
    content,
    attachment_path: attachmentPath ?? null,
  });
  if (error) {
    console.error("[support] reply failed:", error.message);
    return { error: "Couldn't send your reply — please try again." };
  }

  // A reply on a closed ticket reopens it, so it isn't missed.
  await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", ticketId).eq("status", "closed");

  revalidatePath(`/dashboard/support/${ticketId}`);
  return { ok: true };
}

/** Form fields: ticket_id, status. Church admins (own church) and super admins only. */
export async function updateTicketStatus(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again to continue." };
  if (me.role !== "super_admin" && me.role !== "church_admin") return { error: "Only admins can change a ticket's status." };

  const parsed = ticketStatusSchema.safeParse({ ticketId: formData.get("ticket_id"), status: formData.get("status") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Unknown status." };

  const supabase = createClient();
  let query = supabase.from("support_tickets").update({ status: parsed.data.status }).eq("id", parsed.data.ticketId);
  if (me.role === "church_admin") query = query.eq("church_id", me.church_id);
  const { data: updated, error } = await query.select("id");
  if (error) {
    console.error("[support] status update failed:", error.message);
    return { error: "Couldn't update the status — please try again." };
  }
  if (!updated?.length) return { error: "That ticket couldn't be found." };

  revalidatePath(`/dashboard/support/${parsed.data.ticketId}`);
  revalidatePath("/dashboard/support");
  return { ok: true };
}
