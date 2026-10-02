"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { isOwnAttachmentPath } from "@/lib/support";
import { newTicketSchema } from "@/lib/support-schemas";

/**
 * Opens a support ticket with its first message.
 * Form fields: subject, priority, message, attachment_path?
 * Returns { error } with a user-facing message, or redirects to the ticket.
 */
export async function createTicket(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again, then resubmit." };
  const access = await checkModuleAccess("support");
  if (!access.allowed) return { error: access.reason ?? "Support isn't available on your church's plan." };

  const parsed = newTicketSchema.safeParse({
    subject: formData.get("subject"),
    priority: formData.get("priority"),
    message: formData.get("message"),
    attachmentPath: formData.get("attachment_path") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const input = parsed.data;
  if (input.attachmentPath && !isOwnAttachmentPath(input.attachmentPath, me.id)) {
    return { error: "That attachment couldn't be used — please upload it again." };
  }

  const supabase = createClient();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ church_id: me.church_id, created_by: me.id, subject: input.subject, priority: input.priority })
    .select("id")
    .single();
  if (error || !ticket) {
    console.error("[support] ticket create failed:", error?.message);
    return { error: "Couldn't open your ticket — please try again. Your message is still in the form." };
  }

  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: me.id,
    content: input.message,
    attachment_path: input.attachmentPath ?? null,
  });
  if (messageError) {
    // The ticket exists but is empty. Members can't delete tickets (no
    // delete policy), so say exactly what happened rather than retrying blind.
    console.error("[support] first message failed:", messageError.message);
    return {
      error: `Your ticket "${input.subject}" was opened, but the message didn't save. Open it from the Support list and send the message again.`,
    };
  }

  redirect(`/dashboard/support/${ticket.id}`);
}
