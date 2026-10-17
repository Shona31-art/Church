"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can, isShepherd } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { flash } from "@/lib/flash";
import { POSTER_BUCKET } from "@/lib/posters/assets";
import { DESIGN_VERSION, PosterDesignSchema, assetPaths, type PosterDesign } from "@/lib/posters/design";

// Saving editable posters (Poster Studio v2). Re-checks session, plan
// (ai_poster) and role; re-validates the whole design with Zod; and RLS on
// `posters` limits writes to the church's poster makers (insert) and the
// creator or pastors/admins (update). See supabase/poster_editor.sql.

type SaveResult = { ok: true; id: string; updatedAt: string } | { ok: false; error: string; conflict?: boolean; signedOut?: boolean };

const Input = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Give the poster a name.").max(120, "Keep the name under 120 characters."),
  /** For edits: the updated_at the editor loaded, so a newer save by someone else isn't overwritten. */
  expectedUpdatedAt: z.string().optional(),
  design: z.unknown(),
});

/**
 * Input: { id? (omit to create), title, expectedUpdatedAt? (edits), design: PosterDesign }
 * Returns the poster's id and new updated_at, or an error (conflict: true if
 * someone else saved this poster after it was opened).
 */
export async function savePosterDesign(input: { id?: string; title: string; expectedUpdatedAt?: string; design: PosterDesign }): Promise<SaveResult> {
  const me = await getCurrentAppUser();
  if (!me) return { ok: false, error: "Your session has expired. Sign in again; your design is kept on this device.", signedOut: true };
  if (!(await checkModuleAccess("ai_poster")).allowed) return { ok: false, error: "Poster Studio isn't included in your church's plan." };
  if (!can(me.role, "makePosters")) return { ok: false, error: "Only pastors, church admins and department leaders can make posters." };

  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That didn't look right." };
  const design = PosterDesignSchema.safeParse(parsed.data.design);
  if (!design.success) {
    console.error("[posters] invalid design:", design.error.issues.slice(0, 3));
    return { ok: false, error: "This design has something the app can't save. Undo your last change and try again." };
  }
  // Uploaded photos must be this church's own (the server signs them for viewing later).
  if (assetPaths(design.data).some((p) => !p.startsWith(`${me.church_id}/`))) {
    return { ok: false, error: "This design uses a photo from outside your church's library." };
  }

  const { id, title, expectedUpdatedAt } = parsed.data;
  const row = {
    title,
    event_title: title, // older screens and the list read event_title
    design: design.data,
    design_version: DESIGN_VERSION,
    width: design.data.width,
    height: design.data.height,
  };
  const supabase = createClient();

  if (!id) {
    const { data, error } = await supabase
      .from("posters")
      .insert({ ...row, church_id: me.church_id, created_by: me.id })
      .select("id, updated_at")
      .single();
    if (error) {
      console.error("[posters] create failed:", error.message);
      return { ok: false, error: "Couldn't save the poster. Check your connection and try again." };
    }
    revalidatePath("/dashboard/posters");
    return { ok: true, id: data.id, updatedAt: data.updated_at };
  }

  let update = supabase.from("posters").update(row).eq("id", id).eq("church_id", me.church_id);
  if (expectedUpdatedAt) update = update.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await update.select("id, updated_at").maybeSingle();
  if (error) {
    console.error("[posters] update failed:", error.message);
    return { ok: false, error: "Couldn't save the poster. Check your connection and try again." };
  }
  if (!data) {
    // Either someone saved it since it was opened, or this person can't edit it (RLS).
    const { data: current } = await supabase.from("posters").select("updated_at").eq("id", id).maybeSingle();
    return current
      ? { ok: false, conflict: true, error: "Someone else saved this poster after you opened it. Save as a copy to keep your changes." }
      : { ok: false, error: "This poster no longer exists, or you can't edit it." };
  }
  revalidatePath("/dashboard/posters");
  revalidatePath(`/dashboard/posters/${id}`);
  return { ok: true, id: data.id, updatedAt: data.updated_at };
}

// ---------------------------------------------------------------------------
// List previews (thumbnails) and duplicating
// ---------------------------------------------------------------------------

/** Loads a poster the signed-in person may edit (creator, or pastor/admin), or null. */
async function editablePoster(id: string) {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "makePosters") || !z.string().uuid().safeParse(id).success) return null;
  const { data } = await createClient().from("posters").select("id, church_id, created_by, thumbnail_path").eq("id", id).eq("church_id", me.church_id).maybeSingle();
  if (!data || (data.created_by !== me.id && !isShepherd(me.role))) return null;
  return { me, poster: data };
}

/** Input: poster id. Returns a one-time signed upload URL for a new preview image of that poster. */
export async function requestThumbnailUpload(posterId: string): Promise<{ ok: true; path: string; token: string } | { ok: false }> {
  const found = await editablePoster(posterId);
  if (!found) return { ok: false };
  const path = `${found.poster.church_id}/thumbs/${posterId}-${randomUUID()}.jpg`;
  const { data, error } = await createAdminClient().storage.from(POSTER_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[posters] thumbnail upload URL failed:", error?.message);
    return { ok: false };
  }
  return { ok: true, path, token: data.token };
}

/** Input: poster id + the uploaded preview's path. Points the poster at it and deletes the previous preview. */
export async function setPosterThumbnail(posterId: string, path: string): Promise<{ ok: boolean }> {
  const found = await editablePoster(posterId);
  if (!found || !path.startsWith(`${found.poster.church_id}/thumbs/${posterId}-`) || !/^[0-9a-f/-]+\.jpg$/.test(path)) return { ok: false };
  const admin = createAdminClient();
  const folder = `${found.poster.church_id}/thumbs`;
  const name = path.slice(folder.length + 1);
  const { data: exists } = await admin.storage.from(POSTER_BUCKET).list(folder, { search: name, limit: 1 });
  if (!exists?.some((f) => f.name === name)) return { ok: false };

  // RLS: only the creator or a pastor/admin can update the poster row.
  const { error } = await createClient().from("posters").update({ thumbnail_path: path }).eq("id", posterId);
  if (error) {
    console.error("[posters] set thumbnail failed:", error.message);
    return { ok: false };
  }
  if (found.poster.thumbnail_path && found.poster.thumbnail_path !== path) {
    await admin.storage.from(POSTER_BUCKET).remove([found.poster.thumbnail_path]);
  }
  revalidatePath("/dashboard/posters");
  return { ok: true };
}

/** Form action (poster page): copy a poster as a new one owned by the person copying it, then open it. */
export async function duplicatePosterAction(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me) redirect("/login");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success || !can(me.role, "makePosters") || !(await checkModuleAccess("ai_poster")).allowed) {
    flash("You can't copy this poster.", "error");
    redirect("/dashboard/posters");
  }
  const supabase = createClient();
  const { data: original } = await supabase.from("posters").select("*").eq("id", id.data).eq("church_id", me.church_id).maybeSingle();
  if (!original) {
    flash("That poster no longer exists.", "error");
    redirect("/dashboard/posters");
  }
  const title = `${original.title ?? original.event_title} (copy)`.slice(0, 120);
  const { data: copy, error } = await supabase
    .from("posters")
    .insert({
      church_id: me.church_id,
      created_by: me.id,
      title: original.design ? title : null,
      event_title: title,
      tagline: original.tagline,
      speaker: original.speaker,
      event_date: original.event_date,
      location: original.location,
      template_key: original.template_key,
      theme_color: original.theme_color,
      format: original.format,
      design: original.design,
      design_version: original.design_version,
      width: original.width,
      height: original.height,
    })
    .select("id, design_version")
    .single();
  if (error || !copy) {
    console.error("[posters] duplicate failed:", error?.message);
    flash("Couldn't copy the poster. Try again.", "error");
    redirect(`/dashboard/posters/${id.data}`);
  }
  revalidatePath("/dashboard/posters");
  flash("Copy made. You're editing the copy.");
  redirect(copy.design_version ? `/dashboard/posters/editor/${copy.id}` : `/dashboard/posters/${copy.id}/edit`);
}
