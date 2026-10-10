// Where profile photos live in Supabase Storage (pure — unit-tested; safe in
// the browser and on the server).
//
//   avatars/<church_id>/<user_id>/<random uuid>.<webp|jpg>
//
// The storage policies in supabase/chat_v2.sql allow uploads only into your
// own church/user folder, and the app_users trigger only accepts a path in
// that folder — this module builds and checks the same shape.

export const AVATAR_BUCKET = "avatars";

/** Photos are resized to this square before upload (sharp on any phone screen). */
export const AVATAR_SIZE = 512;

/** Largest original a member can pick; it's shrunk well below this before upload. */
export const AVATAR_MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function avatarPath(churchId: string, userId: string, fileId: string, extension: "webp" | "jpg"): string {
  return `${churchId}/${userId}/${fileId}.${extension}`;
}

/** True only for a path inside this person's own folder, with a random file name. */
export function isOwnAvatarPath(path: string, churchId: string, userId: string): boolean {
  return new RegExp(`^${churchId}/${userId}/${UUID}\\.(webp|jpg)$`, "i").test(path);
}
