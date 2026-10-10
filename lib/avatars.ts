import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET } from "@/lib/avatar-path";

// Profile photos are private files (members' faces, possibly children's), so
// pages get short-lived signed links rather than public URLs. Links last an
// hour — longer than any page stays open in practice.
const LINK_SECONDS = 60 * 60;

/**
 * Photo links for a set of people, keyed by user id. People without a photo
 * are simply missing from the map (show their initials).
 *
 * Deliberately forgiving: if the photo column doesn't exist yet (chat_v2.sql
 * not run) or Storage is unreachable, it returns an empty map and every page
 * keeps working with initials.
 */
export async function getAvatarUrls(userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const urls = new Map<string, string>();
  if (ids.length === 0) return urls;

  const supabase = createClient();
  const { data, error } = await supabase.from("app_users").select("id, avatar_path").in("id", ids).not("avatar_path", "is", null);
  if (error) {
    // 42703 = column missing: the migration hasn't been run yet. Not worth logging every page view.
    if (error.code !== "42703") console.error("[avatars] couldn't load photo paths:", error.message);
    return urls;
  }
  if (!data?.length) return urls;

  const { data: signed, error: signError } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(
    data.map((row) => row.avatar_path as string),
    LINK_SECONDS
  );
  if (signError) {
    console.error("[avatars] couldn't sign photo links:", signError.message);
    return urls;
  }

  const byPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  for (const row of data) {
    const url = byPath.get(row.avatar_path as string);
    if (url) urls.set(row.id, url);
  }
  return urls;
}
