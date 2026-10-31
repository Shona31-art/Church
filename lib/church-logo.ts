// Where church logos live in Supabase Storage (pure — unit-tested; safe in the
// browser and on the server). Rules: supabase/church_logo.sql.
//
//   church-logos/<church_id>/<random uuid>.<webp|jpg|png>

export const CHURCH_LOGO_BUCKET = "church-logos";

/** Logos are shrunk to fit inside this many pixels (keeping their shape) before upload. */
export const CHURCH_LOGO_MAX_DIMENSION = 512;
export const CHURCH_LOGO_MAX_BYTES = 400 * 1024;
export const CHURCH_LOGO_MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function churchLogoPath(churchId: string, fileId: string, extension: "webp" | "jpg" | "png"): string {
  return `${churchId}/${fileId}.${extension}`;
}

/** True only for a path inside this church's own folder, with a random file name. */
export function isOwnChurchLogoPath(path: string, churchId: string): boolean {
  return new RegExp(`^${churchId}/${UUID}\\.(webp|jpg|png)$`, "i").test(path);
}

/** The storage path inside our bucket for a saved logo link, or null if the link points elsewhere. */
export function churchLogoPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${CHURCH_LOGO_BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
}
