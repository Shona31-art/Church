"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function createTicket(formData: FormData) {
  const me = await getCurrentAppUser();
  if (!me) return;

  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const priority = String(formData.get("priority") || "normal");
  const attachmentUrl = String(formData.get("attachment_url") || "") || null;

  if (!subject || !message) return;

  const supabase = createClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .insert({ church_id: me.church_id, created_by: me.id, subject, priority })
    .select("id")
    .single();

  if (ticket) {
    await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: me.id,
      content: message,
      attachment_url: attachmentUrl,
    });
    redirect(`/dashboard/support/${ticket.id}`);
  }
}
