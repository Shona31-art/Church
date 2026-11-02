import "server-only";

// Daily.co video calls (https://docs.daily.co/reference/rest-api). Rooms are
// private: joining needs a meeting token, which the server only gives to
// people allowed into that call. The API key never leaves the server.

const API = "https://api.daily.co/v1";

export function isVideoConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY);
}

async function daily<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Daily ${init.method} ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** A new private room that closes itself (and removes everyone) at `expiresAt`. */
export async function createRoom(opts: { name: string; expiresAt: Date; maxParticipants: number; audioOnly?: boolean }): Promise<{ name: string; url: string }> {
  const room = await daily<{ name: string; url: string }>("/rooms", {
    method: "POST",
    body: {
      name: opts.name,
      privacy: "private",
      properties: {
        exp: Math.floor(opts.expiresAt.getTime() / 1000),
        eject_at_room_exp: true,
        max_participants: opts.maxParticipants,
        enable_prejoin_ui: true,
        // A voice call: everyone joins with their camera off (they can turn it on).
        start_video_off: Boolean(opts.audioOnly),
        enable_chat: true,
        enable_screenshare: true,
        enable_knocking: false,
        // No recordings: these are private pastoral and church conversations.
        enable_recording: false,
        lang: "en",
      },
    },
  });
  return { name: room.name, url: room.url };
}

/** A pass into one room for one person, valid until the room closes. */
export async function createMeetingToken(opts: { roomName: string; userId: string; userName: string; expiresAt: Date; isOwner: boolean }): Promise<string> {
  const { token } = await daily<{ token: string }>("/meeting-tokens", {
    method: "POST",
    body: {
      properties: {
        room_name: opts.roomName,
        user_id: opts.userId,
        user_name: opts.userName.slice(0, 60),
        exp: Math.floor(opts.expiresAt.getTime() / 1000),
        is_owner: opts.isOwner,
        enable_recording: false,
      },
    },
  });
  return token;
}

/** Ends a call for everyone. A room that's already gone counts as done. */
export async function deleteRoom(name: string): Promise<void> {
  try {
    await daily(`/rooms/${encodeURIComponent(name)}`, { method: "DELETE" });
  } catch (error) {
    if (!/ 404 /.test((error as Error).message)) throw error;
  }
}
