"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
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
