import { z } from "zod";
import { BOOKING_STATUSES, BOOKING_TYPES } from "@/lib/booking";

// Server-side input validation for the booking actions.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");

/**
 * `today` is passed in (YYYY-MM-DD) so the rule is testable. Callers use the
 * server's UTC date, which is never ahead of a South African user's local
 * date — so "today" is always accepted.
 */
export function bookingRequestSchema(today: string) {
  return z.object({
    bookingType: z.enum(BOOKING_TYPES, { message: "Choose what kind of service you need." }),
    pastorId: z.string().uuid().optional(),
    preferredDate: isoDate.refine((d) => d >= today, "The preferred date can't be in the past."),
    preferredTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Choose a valid time.")
      .optional(),
    location: z.string().trim().max(200, "Location is too long (200 characters max).").optional(),
    details: z.string().trim().max(4000, "Details are too long (4,000 characters max).").optional(),
  });
}

export const statusChangeSchema = z.object({
  bookingId: z.string().uuid(),
  from: z.enum(BOOKING_STATUSES),
  to: z.enum(BOOKING_STATUSES),
  declineReason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
});

export const availabilityBlockSchema = z
  .object({
    pastorId: z.string().uuid().optional(),
    blockedDate: isoDate,
    /** Last day away; leave empty for a single day. */
    untilDate: isoDate.optional(),
    note: z.string().trim().max(200, "Keep the note under 200 characters.").optional(),
  })
  .refine((v) => !v.untilDate || v.untilDate >= v.blockedDate, { message: "The “until” date must be on or after the first day away.", path: ["untilDate"] });
