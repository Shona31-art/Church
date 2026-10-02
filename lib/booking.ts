// Pastor booking rules shared by the request form, the approval actions and
// the detail page. Zod schemas live in booking-schemas.ts so this file stays
// light enough to import from client components. The database enforces the
// same type/status values (check constraints in service_booking_schema.sql)
// — keep them in sync.

export const BOOKING_TYPES = ["wedding", "funeral", "thanksgiving", "baptism", "counselling", "other"] as const;
export const BOOKING_STATUSES = ["pending", "approved", "declined", "completed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// The only status changes a pastor can make. Declined and completed are
// final, so a decision can't be quietly reversed after the requester has
// been told.
const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["approved", "declined"],
  approved: ["completed"],
  declined: [],
  completed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Today's date as YYYY-MM-DD (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
