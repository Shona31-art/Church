"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";

// Testimonies (church_life.sql): members share, a pastor approves before
// anyone else sees it. RLS enforces the same rules.

const schema = z.object({
  title: z.string().trim().max(120, "Keep the title to 120 characters.").transform((v) => v || null),
  body: z.string().trim().min(10, "Tell a little more — at least a sentence or two.").max(3000, "Keep it to 3,000 characters."),
  showName: z.boolean(),
});

/** Form fields: title?, body, show_name ("on" | absent) */
export async function shareTestimony(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: SESSION_EXPIRED, values: formValues(formData) };
  if (!(await checkModuleAccess("testimonies")).allowed) return { error: "Testimonies aren't on your church's plan." };
  const parsed = schema.safeParse({ title: formData.get("title") ?? "", body: formData.get("body") ?? "", showName: formData.get("show_name") === "on" });
  if (!parsed.success) return invalid(parsed.error, formData);
  const { error } = await createClient()
    .from("testimonies")
    .insert({ church_id: me.church_id, user_id: me.id, title: parsed.data.title, body: parsed.data.body, show_name: parsed.data.showName });
  if (error) {
    console.error("[testimonies] share failed:", error.message);
    return { error: "Couldn't send it — please try again. Your words are still here.", values: formValues(formData) };
  }
  revalidatePath("/dashboard/testimonies");
  flash(can(me.role, "moderatePrayerWall") ? "Thank you! Approve it under Waiting to put it on the wall." : "Thank you for sharing! A pastor will look at it soon, then it goes on the wall.");
  return { ok: true };
}

/** Pastors: approve or decline. Form fields: id, decision ("approved" | "declined") */
export async function reviewTestimony(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const parsed = z.object({ id: z.string().uuid(), decision: z.enum(["approved", "declined"]) }).safeParse({ id: formData.get("id"), decision: formData.get("decision") });
  if (!me?.church_id || !parsed.success || !can(me.role, "moderatePrayerWall")) return;
  const { error } = await createClient()
    .from("testimonies")
    .update({ status: parsed.data.decision, reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("church_id", me.church_id);
  if (error) {
    console.error("[testimonies] review failed:", error.message);
    flash("Couldn't save that — please try again.", "error");
    return;
  }
  revalidatePath("/dashboard/testimonies");
  flash(parsed.data.decision === "approved" ? "Approved — it's on the wall, and they've been told." : "Declined. Only they can still see it.");
}

/** The author (any time) or a pastor. Form fields: id */
export async function deleteTestimony(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!me?.church_id || !id.success) return;
  const { data, error } = await createClient().from("testimonies").delete().eq("id", id.data).select("id");
  if (error || !data?.length) {
    flash("Couldn't remove it — please try again.", "error");
    return;
  }
  revalidatePath("/dashboard/testimonies");
  flash("Removed.");
}
