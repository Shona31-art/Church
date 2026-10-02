import { z } from "zod";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/support";

// Server-side input validation for the support desk actions. Attachment
// paths are checked separately against the signed-in user (isOwnAttachmentPath).

const message = z
  .string()
  .trim()
  .min(1, "Write a message before sending.")
  .max(5000, "That message is too long (5,000 characters max).");

export const newTicketSchema = z.object({
  subject: z.string().trim().min(3, "Give the ticket a short subject.").max(150, "Keep the subject under 150 characters."),
  priority: z.enum(TICKET_PRIORITIES, { message: "Choose a priority." }),
  message,
  attachmentPath: z.string().optional(),
});

export const replySchema = z.object({
  ticketId: z.string().uuid(),
  content: message,
  attachmentPath: z.string().optional(),
});

export const ticketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(TICKET_STATUSES, { message: "Unknown status." }),
});
