"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { localInputToUtcIso } from "@/lib/format";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";

const optionalUuid = z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null);
const schema = z.object({
  title: z.string().trim().min(1, "Give the service a title.").max(160),
  startsAt: z.string().min(1, "Choose when it starts."),
  streamUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Paste the full link, starting with https://")
    .transform((v) => v || null),
  servicePlanId: optionalUuid,
  outlineId: optionalUuid,
  songIds: z.array(z.string().uuid()).max(30, "Choose up to 30 songs."),
  message: z.string().trim().max(1000).transform((v) => v || null),
  notify: z.boolean(),
});

/** Pastors: set up (or edit) a live service. Form fields: id?, title, starts_at, stream_url?, service_plan_id?, outline_id?, song_ids[], message?, notify */
export async function saveLiveService(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "planServices")) return { error: SESSION_EXPIRED, values: formValues(formData) };
  if (!(await checkModuleAccess("live_sunday")).allowed) return { error: "Live Sunday isn't on your church's plan." };
  const parsed = schema.safeParse({
    title: formData.get("title") ?? "",
    startsAt: formData.get("starts_at") ?? "",
    streamUrl: formData.get("stream_url") ?? "",
    servicePlanId: formData.get("service_plan_id") ?? "",
    outlineId: formData.get("outline_id") ?? "",
    songIds: formData.getAll("song_ids").map(String),
    message: formData.get("message") ?? "",
    notify: formData.get("notify") === "on",
  });
  if (!parsed.success) {
    const r = invalid(parsed.error, formData);
    if (r?.fieldErrors) for (const [a, b] of [["startsAt", "starts_at"], ["streamUrl", "stream_url"]]) if (r.fieldErrors[a]) r.fieldErrors[b] = r.fieldErrors[a];
    return r;
  }
  const startsAt = localInputToUtcIso(parsed.data.startsAt);
  if (!startsAt) return { error: "Choose a valid start time.", fieldErrors: { starts_at: "Choose a valid start time." }, values: formValues(formData) };
  const row = {
    title: parsed.data.title,
    starts_at: startsAt,
    stream_url: parsed.data.streamUrl,
    service_plan_id: parsed.data.servicePlanId,
    outline_id: parsed.data.outlineId,
    song_ids: parsed.data.songIds,
    message: parsed.data.message,
  };
  const id = z.string().uuid().safeParse(formData.get("id"));
  const supabase = createClient();
  const { data, error } = id.success
    ? await supabase.from("live_services").update(row).eq("id", id.data).eq("church_id", me.church_id).select("id").single()
    : await supabase.from("live_services").insert({ ...row, church_id: me.church_id, created_by: me.id }).select("id").single();
  if (error || !data) {
    console.error("[live] save failed:", error?.message);
    return { error: "Couldn't save — please try again.", values: formValues(formData) };
  }

  if (parsed.data.notify) {
    const admin = createAdminClient();
    const { data: people } = await admin.from("app_users").select("id").eq("church_id", me.church_id).eq("status", "active").neq("id", me.id);
    if (people?.length) {
      const { error: nErr } = await admin.from("notifications").insert(
        people.map((p) => ({
          user_id: p.id,
          church_id: me.church_id,
          category: "church_news",
          type: "live.started",
          title: `🔴 ${parsed.data.title}`,
          body: "Join us live — the order of service and song words are in the app.",
          link: `/dashboard/live?id=${data.id}`,
          actor_id: me.id,
        })),
      );
      if (nErr) console.error("[live] notify failed:", nErr.message);
    }
  }
  revalidatePath("/dashboard/live");
  flash(parsed.data.notify ? "Saved, and the church has been told." : "Saved.");
  redirect(`/dashboard/live?id=${data.id}`);
}

/** Pastors. Form fields: id */
export async function deleteLiveService(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!me?.church_id || !id.success || !can(me.role, "planServices")) return;
  await createClient().from("live_services").delete().eq("id", id.data).eq("church_id", me.church_id);
  revalidatePath("/dashboard/live");
  flash("Deleted.");
  redirect("/dashboard/live");
}
