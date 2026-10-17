"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can, isShepherd } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, POSTER_BUCKET, UPLOAD_TYPES, signPosterAssets } from "@/lib/posters/assets";

// The church's poster photo library (speaker photos, logos, backgrounds).
// Uploads go straight from the browser to Storage through a one-time signed
// upload URL that only this server can issue, to a path it chooses. The
// library row is then written as the uploader, so RLS (poster_editor.sql)
// double-checks church, role and folder.

export interface LibraryPhoto {
  id: string;
  path: string;
  url: string;
  width: number;
  height: number;
  kind: "photo" | "logo";
  label: string | null;
  uploadedBy: string | null;
  canDelete: boolean;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function posterMaker() {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired. Sign in again; your poster is kept on this device." } as const;
  if (!(await checkModuleAccess("ai_poster")).allowed) return { error: "Poster Studio isn't included in your church's plan." } as const;
  if (!can(me.role, "makePosters") || !me.church_id) return { error: "Only pastors, church admins and department leaders can add poster photos." } as const;
  return { me: me as typeof me & { church_id: string } } as const;
}

/**
 * Input: { contentType: image/webp|jpeg|png, bytes }
 * Returns a one-time signed upload URL for a new file in the uploader's own folder.
 */
export async function requestPosterUpload(input: { contentType: string; bytes: number }): Promise<Result<{ path: string; token: string }>> {
  const auth = await posterMaker();
  if ("error" in auth) return { ok: false, error: auth.error! };
  const parsed = z
    .object({ contentType: z.enum(Object.keys(UPLOAD_TYPES) as [keyof typeof UPLOAD_TYPES]), bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Photos must be JPG, PNG or WebP and under 5 MB." };

  const path = `${auth.me.church_id}/${auth.me.id}/${randomUUID()}.${UPLOAD_TYPES[parsed.data.contentType]}`;
  const { data, error } = await createAdminClient().storage.from(POSTER_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[posters] signed upload failed:", error?.message);
    return { ok: false, error: "Couldn't start the upload. Try again." };
  }
  return { ok: true, data: { path, token: data.token } };
}

/**
 * Input: { path (from requestPosterUpload), width, height, bytes, kind, label? }
 * Records an uploaded photo in the library after checking the file really arrived.
 */
export async function registerPosterAsset(input: { path: string; width: number; height: number; bytes: number; kind: "photo" | "logo"; label?: string }): Promise<Result<LibraryPhoto>> {
  const auth = await posterMaker();
  if ("error" in auth) return { ok: false, error: auth.error! };
  const parsed = z
    .object({
      path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/),
      width: z.number().int().min(1).max(10000),
      height: z.number().int().min(1).max(10000),
      bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
      kind: z.enum(["photo", "logo"]),
      label: z.string().trim().max(120).optional(),
    })
    .safeParse(input);
  if (!parsed.success || !parsed.data.path.startsWith(`${auth.me.church_id}/${auth.me.id}/`)) return { ok: false, error: "That upload didn't look right. Try again." };

  // The file must actually exist in the uploader's folder before it's listed.
  const folder = parsed.data.path.slice(0, parsed.data.path.lastIndexOf("/"));
  const name = parsed.data.path.slice(folder.length + 1);
  const { data: found } = await createAdminClient().storage.from(POSTER_BUCKET).list(folder, { search: name, limit: 1 });
  if (!found?.some((f) => f.name === name)) return { ok: false, error: "The photo didn't finish uploading. Try again." };

  const { data, error } = await createClient()
    .from("poster_assets")
    .insert({
      church_id: auth.me.church_id,
      uploaded_by: auth.me.id,
      storage_path: parsed.data.path,
      kind: parsed.data.kind,
      label: parsed.data.label || null,
      width: parsed.data.width,
      height: parsed.data.height,
      bytes: parsed.data.bytes,
    })
    .select("id, storage_path, width, height, kind, label, uploaded_by")
    .single();
  if (error) {
    console.error("[posters] register asset failed:", error.message);
    return { ok: false, error: "Couldn't add the photo to your library. Try again." };
  }
  const urls = await signPosterAssets([data.storage_path], auth.me.church_id);
  return { ok: true, data: toLibraryPhoto(data, urls, auth.me.id, true) };
}

/** The church's photo library, newest first (up to 120), with viewing links. */
export async function listPosterAssets(): Promise<Result<LibraryPhoto[]>> {
  const auth = await posterMaker();
  if ("error" in auth) return { ok: false, error: auth.error! };
  const { data, error } = await createClient()
    .from("poster_assets")
    .select("id, storage_path, width, height, kind, label, uploaded_by")
    .eq("church_id", auth.me.church_id)
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) {
    console.error("[posters] list assets failed:", error.message);
    return { ok: false, error: "Couldn't load your photo library." };
  }
  const urls = await signPosterAssets((data ?? []).map((a) => a.storage_path), auth.me.church_id);
  const shepherd = isShepherd(auth.me.role);
  return { ok: true, data: (data ?? []).map((a) => toLibraryPhoto(a, urls, auth.me.id, shepherd)) };
}

/** Input: asset id. Deletes it from the library and Storage (own photos; pastors/admins any). Posters using it show an empty photo slot. */
export async function deletePosterAsset(id: string): Promise<Result<undefined>> {
  const auth = await posterMaker();
  if ("error" in auth) return { ok: false, error: auth.error! };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "That didn't look right." };

  // RLS decides whether this person may delete it; `select` tells us if anything was deleted.
  const { data, error } = await createClient().from("poster_assets").delete().eq("id", id).select("storage_path").maybeSingle();
  if (error) {
    console.error("[posters] delete asset failed:", error.message);
    return { ok: false, error: "Couldn't delete the photo. Try again." };
  }
  if (!data) return { ok: false, error: "You can only delete photos you uploaded." };
  const { error: removeError } = await createAdminClient().storage.from(POSTER_BUCKET).remove([data.storage_path]);
  if (removeError) console.error("[posters] removing deleted photo's file failed (orphaned file):", removeError.message);
  return { ok: true, data: undefined };
}

function toLibraryPhoto(
  a: { id: string; storage_path: string; width: number; height: number; kind: string; label: string | null; uploaded_by: string | null },
  urls: Record<string, string>,
  me: string,
  shepherd: boolean,
): LibraryPhoto {
  return {
    id: a.id,
    path: a.storage_path,
    url: urls[a.storage_path] ?? "",
    width: a.width,
    height: a.height,
    kind: a.kind as "photo" | "logo",
    label: a.label,
    uploadedBy: a.uploaded_by,
    canDelete: shepherd || a.uploaded_by === me,
  };
}
