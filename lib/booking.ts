// Pastor booking rules shared by the request form, the approval actions and
// the detail page. Zod schemas live in booking-schemas.ts so this file stays
// light enough to import from client components. The database enforces the
// same type/status values (check constraints in service_booking_schema.sql)
// — keep them in sync.

export const BOOKING_TYPES = ["wedding", "funeral", "thanksgiving", "baptism", "counselling", "other"] as const;
export const BOOKING_STATUSES = ["pending", "approved", "declined", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// The only status changes a pastor can make. Declined, completed and
// cancelled are final, so a decision can't be quietly reversed after the
// requester has been told. (Requesters withdraw their own request through the
// cancel_booking_request() database function instead.)
const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["approved", "declined"],
  approved: ["completed", "cancelled"],
  declined: [],
  completed: [],
  cancelled: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Today's date as YYYY-MM-DD (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Waiting for a pastor",
  approved: "Approved",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const BOOKING_TYPE_LABELS: Record<(typeof BOOKING_TYPES)[number], string> = {
  wedding: "Wedding",
  funeral: "Funeral",
  thanksgiving: "Thanksgiving",
  baptism: "Baptism",
  counselling: "Counselling",
  other: "Other",
};
