// Rules for video calls (pure — unit-tested). See supabase/video_calls.sql.

/** Calls end on their own after this long, so a forgotten call never keeps running up minutes. */
export const CALL_HOURS = 3;

/** Room sizes: a private chat is two people; an appointment, the member plus a pastor or two. */
export const MAX_PARTICIPANTS = { dm: 2, booking: 4, group: 50 } as const;

/**
 * When an approved appointment's video call can be used: on the day it's
 * booked for and the day after (for late-evening appointments and time zones).
 * Dates are YYYY-MM-DD in the church's time zone.
 */
export function bookingCallWindow(bookingDate: string, today: string): "early" | "open" | "past" {
  if (today < bookingDate) return "early";
  const next = new Date(`${bookingDate}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return today <= next.toISOString().slice(0, 10) ? "open" : "past";
}

/** Is this call still running? */
export function isCallOpen(call: { ended_at: string | null; expires_at: string }, now: Date = new Date()): boolean {
  return !call.ended_at && new Date(call.expires_at).getTime() > now.getTime();
}

/** A Daily room name: letters, numbers and dashes only, unguessable. */
export function newRoomName(random: string = crypto.randomUUID()): string {
  return `grace-${random.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
}
