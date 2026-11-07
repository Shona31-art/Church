"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { JIGSAW_BUCKET } from "@/lib/games/jigsaw";

// Pastors and church admins manage the church's jigsaw pictures
// (supabase/jigsaw_pictures.sql enforces the same). Files go to a private
// bucket that only the server touches.

export type PictureResult = { ok: true } | { ok: false; error: string };

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function manager() {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: "Your session has expired — sign in again." } as const;
  if (!can(me.role, "manageQuizQuestions")) return { error: "Only pastors and church admins can change the jigsaw pictures." } as const;
  return { me: me as typeof me & { church_id: string } } as const;
}

async function save(me: { id: string; church_id: string }, image: { mimeType: string; data: string }, title: string, reference: string | null, source: "upload"): Promise<PictureResult> {
  const ext = EXT[image.mimeType];
  if (!ext) return { ok: false, error: "Pictures must be JPG, PNG or WebP." };
  const bytes = Buffer.from(image.data, "base64");
  if (bytes.length > 5 * 1024 * 1024) return { ok: false, error: "That picture is over 5 MB." };
  const path = `${me.church_id}/${randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(JIGSAW_BUCKET).upload(path, bytes, { contentType: image.mimeType, upsert: false });
  if (uploadError) {
    console.error("[jigsaw] upload failed:", uploadError.message);
    return {
      ok: false,
      error: /bucket.*not.*found/i.test(uploadError.message) ? "Jigsaw pictures need a database update: run supabase/jigsaw_pictures.sql." : "Couldn't save the picture — please try again.",
    };
  }
  const { error } = await createClient().from("jigsaw_pictures").insert({ church_id: me.church_id, title, reference, storage_path: path, source, created_by: me.id });
  if (error) {
    console.error("[jigsaw] save failed:", error.message);
    await admin.storage.from(JIGSAW_BUCKET).remove([path]);
    return { ok: false, error: "Couldn't save the picture — please try again." };
  }
  revalidatePath("/dashboard/games/pictures");
  return { ok: true };
}

/** Upload a picture (shrunk in the browser first). */
export async function uploadPicture(input: { mimeType: string; data: string; title: string; reference?: string }): Promise<PictureResult> {
  const auth = await manager();
  if ("error" in auth) return { ok: false, error: auth.error! };
  const parsed = z
    .object({
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      data: z.string().min(1).max(3_000_000).regex(/^[A-Za-z0-9+/=]+$/),
      title: z.string().trim().min(1, "Give the picture a title.").max(120),
      reference: z.string().trim().max(60).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the picture and title." };
  return save(auth.me, parsed.data, parsed.data.title, parsed.data.reference || null, "upload");
}

export async function deletePicture(id: string): Promise<PictureResult> {
  const auth = await manager();
  if ("error" in auth) return { ok: false, error: auth.error! };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "That picture couldn't be found." };
  const { data, error } = await createClient().from("jigsaw_pictures").delete().eq("id", id).eq("church_id", auth.me.church_id).select("storage_path");
  if (error || !data?.length) return { ok: false, error: "Couldn't delete that picture — it may already be gone." };
  await createAdminClient().storage.from(JIGSAW_BUCKET).remove([data[0].storage_path]);
  revalidatePath("/dashboard/games/pictures");
  return { ok: true };
}
