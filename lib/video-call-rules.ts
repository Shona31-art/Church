// Rules for video calls (pure — unit-tested). See supabase/video_calls.sql.

/** Calls end on their own after this long, so a forgotten call never keeps running up minutes. */
export const CALL_HOURS = 3;

/**
 * Call sizes. Built-in calls connect every phone to every other one, so group
 * calls are kept small (each extra person adds another video stream to send).
 */
export const MAX_PARTICIPANTS = { dm: 2, booking: 4, group: 6 } as const;

/** "builtin:6" → 6 (the call's size limit, stored with the call). */
export function callCapacity(roomUrl: string | null | undefined): number {
  const n = Number(/^builtin:(\d+)$/.exec(roomUrl ?? "")?.[1]);
  return Number.isInteger(n) && n >= 2 ? n : MAX_PARTICIPANTS.group;
}

/**
 * Who sends the first "offer" between two phones: the one with the smaller
 * id. Deciding it the same way on both ends stops them both calling each
 * other at once.
 */
export function shouldInitiate(myPeerId: string, theirPeerId: string): boolean {
  return myPeerId < theirPeerId;
}

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

/**
 * How phones find each other. Google's free public STUN servers work for most
 * networks; some mobile networks block direct connections, and then a TURN
 * relay is needed — set TURN_URLS (comma-separated), TURN_USERNAME and
 * TURN_CREDENTIAL (e.g. from metered.ca's free plan). Called on the server
 * (the call page), so only people already allowed into a call are given them.
 */
export function iceServersFrom(env: { TURN_URLS?: string; TURN_USERNAME?: string; TURN_CREDENTIAL?: string }): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const urls = (env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter((u) => /^turns?:/.test(u));
  if (urls.length && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    servers.push({ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  }
  return servers;
}
