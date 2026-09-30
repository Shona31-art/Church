"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function replyToTicket(ticketId: string, formData: FormData) {
  const me = await getCurrentAppUser();
  if (!me) return;

  const content = String(formData.get("content") || "").trim();
  const attachmentUrl = String(formData.get("attachment_url") || "") || null;
  if (!content) return;

  const supabase = createClient();
  await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    sender_id: me.id,
    content,
    attachment_url: attachmentUrl,
  });

  await supabase
    .from("support_tickets")
    .update({ status: "in_progress" })
    .eq("id", ticketId)
    .eq("status", "closed");

  redirect(`/dashboard/support/${ticketId}`);
}

export async function updateTicketStatus(ticketId: string, formData: FormData) {
  const me = await getCurrentAppUser();
  if (!me || (me.role !== "super_admin" && me.role !== "church_admin")) return;

  const status = String(formData.get("status"));
  const supabase = createClient();
  await supabase.from("support_tickets").update({ status }).eq("id", ticketId);

  redirect(`/dashboard/support/${ticketId}`);
}
