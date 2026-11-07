"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { COLORING_BUCKET } from "@/lib/coloring/pages";

// Pastors and church admins add and remove the church's colouring pages
// (record_members.sql enforces the same).

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function manager() {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return null;
  return can(me.role, "manageQuizQuestions") ? (me as typeof me & { church_id: string }) : null;
}

export async function uploadColoringPage(input: { mimeType: string; data: string; title: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await manager();
  if (!me) return { ok: false, error: "Only pastors and church admins can add colouring pages." };
  const parsed = z
    .object({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().min(1).max(3_000_000).regex(/^[A-Za-z0-9+/=]+$/), title: z.string().trim().min(1, "Give the page a title.").max(120) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the picture." };
  const path = `${me.church_id}/${randomUUID()}.${EXT[parsed.data.mimeType]}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(COLORING_BUCKET).upload(path, Buffer.from(parsed.data.data, "base64"), { contentType: parsed.data.mimeType });
  if (upErr) {
    console.error("[coloring] upload failed:", upErr.message);
    return { ok: false, error: /not.*found/i.test(upErr.message) ? "Colouring pages need a database update: run #63 in Supabase." : /size|large/i.test(upErr.message) ? "That picture is too big — try a smaller one." : "Couldn't save the page — please try again." };
  }
  const { error } = await createClient().from("coloring_pages").insert({ church_id: me.church_id, title: parsed.data.title, storage_path: path, created_by: me.id });
  if (error) {
    console.error("[coloring] save failed:", error.message);
    await admin.storage.from(COLORING_BUCKET).remove([path]);
    return { ok: false, error: error.code === "42P01" ? "Colouring pages need a database update: run #63 in Supabase." : "Couldn't save the page — please try again." };
  }
  revalidatePath("/dashboard/games/coloring");
  return { ok: true };
}

export async function deleteColoringPage(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await manager();
  if (!me || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Only pastors and church admins can remove colouring pages." };
  const { data: page } = await createClient().from("coloring_pages").select("storage_path").eq("id", id).eq("church_id", me.church_id).maybeSingle();
  if (!page) return { ok: false, error: "That page wasn't found." };
  const { error } = await createClient().from("coloring_pages").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove it — please try again." };
  await createAdminClient().storage.from(COLORING_BUCKET).remove([page.storage_path]);
  revalidatePath("/dashboard/games/coloring");
  return { ok: true };
}
