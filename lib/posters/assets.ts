import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The private poster-assets bucket has no browser access at all
// (supabase/poster_editor.sql): the server signs every upload and download.
// These helpers run only after the caller has checked who's asking.

export const POSTER_BUCKET = "poster-assets";
/** Long enough for an editing session; links can't be guessed or reused for long. */
export const SIGNED_URL_SECONDS = 60 * 60 * 4;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // matches the bucket limit
export const UPLOAD_TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } as const;

/**
 * Short-lived URLs for photos a poster uses, by storage path. Paths outside
 * the church's own folder are silently skipped, so a design can never be used
 * to read another church's files.
 */
export async function signPosterAssets(paths: string[], churchId: string): Promise<Record<string, string>> {
  const own = [...new Set(paths)].filter((p) => p.startsWith(`${churchId}/`) && !p.includes(".."));
  if (!own.length) return {};
  const { data, error } = await createAdminClient().storage.from(POSTER_BUCKET).createSignedUrls(own, SIGNED_URL_SECONDS);
  if (error) {
    console.error("[posters] signing photo links failed:", error.message);
    return {};
  }
  const urls: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}
