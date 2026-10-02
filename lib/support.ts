// Support desk rules shared by the upload widget (client) and the server
// actions. Zod schemas live in support-schemas.ts to keep this client-light.
// The bucket limits mirror support_security_fix.sql — keep them in sync.

export const TICKET_STATUSES = ["open", "in_progress", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high"] as const;

export const ATTACHMENT_BUCKET = "attachments";
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_EXTENSIONS).join(",");

/** User-facing reason a file can't be attached, or null if it's fine. */
export function attachmentProblem(file: { type: string; size: number }): string | null {
  if (!ATTACHMENT_EXTENSIONS[file.type]) return "Only PNG, JPEG, WebP or GIF images can be attached.";
  if (file.size > ATTACHMENT_MAX_BYTES) return "That image is over 5 MB — try a smaller screenshot.";
  return null;
}

/**
 * Storage path for a new upload: "<user id>/<random id>.<ext>". The user's
 * own folder is required by RLS; the original filename is deliberately not
 * kept (it can contain personal info and breaks URL handling).
 */
export function attachmentPathFor(userId: string, mimeType: string, randomId: string): string {
  return `${userId}/${randomId}.${ATTACHMENT_EXTENSIONS[mimeType]}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NEW_PATH = new RegExp(`^(${UUID})/${UUID}\\.(png|jpg|webp|gif)$`);

/** True only for a path this user's upload widget could have produced. */
export function isOwnAttachmentPath(path: string, userId: string): boolean {
  const match = NEW_PATH.exec(path);
  return Boolean(match && match[1] === userId);
}
