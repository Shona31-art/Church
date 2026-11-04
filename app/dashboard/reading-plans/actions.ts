"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";
import { BOOKS } from "@/lib/bible/books";
import { PRESETS, buildDays } from "@/lib/reading-plans";

const bookName = z.string().refine((b) => BOOKS.some((x) => x.name === b), "Choose a book.");
const schema = z.object({
  preset: z.string(),
  from: bookName.optional(),
  to: bookName.optional(),
  perDay: z.coerce.number().int().min(1).max(10),
  title: z.string().trim().max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
  churchWide: z.boolean(),
});

/** Form fields: preset ("custom" or a preset key), from?, to?, per_day, title?, start_date, church_wide */
export async function createReadingPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("reading_plans")).allowed) return { error: "Reading plans aren't on your church's plan." };
  const parsed = schema.safeParse({
    preset: formData.get("preset") ?? "",
    from: formData.get("from") || undefined,
    to: formData.get("to") || undefined,
    perDay: formData.get("per_day") ?? 1,
    title: formData.get("title") ?? "",
    startDate: formData.get("start_date") ?? "",
    churchWide: formData.get("church_wide") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the plan details.", values: formValues(formData) };
  const p = parsed.data;
  if (p.churchWide && !can(me.role, "postChurchWide")) return { error: "Only pastors and church admins start church-wide plans." };
  const preset = PRESETS.find((x) => x.key === p.preset);
  const from = preset?.from ?? p.from;
  const to = preset?.to ?? p.to ?? from;
  const perDay = preset && p.perDay === 1 ? preset.perDay : p.perDay;
  if (!from || !to) return { error: "Choose the books to read.", values: formValues(formData) };
  const days = buildDays(from, to, perDay);
  if (!days.length) return { error: "The last book must come after the first one.", values: formValues(formData) };
  if (days.length > 400) return { error: `That's ${days.length} days — read more chapters a day, or choose fewer books (400 days at most).`, values: formValues(formData) };
  const title = p.title || preset?.title || (from === to ? from : `${from} to ${to}`);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("reading_plans")
    .insert({ church_id: me.church_id, created_by: me.id, title, description: preset?.description ?? null, start_date: p.startDate, days, church_wide: p.churchWide })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[reading-plans] create failed:", error?.message);
    return { error: "Couldn't start the plan — please try again.", values: formValues(formData) };
  }
  await supabase.from("reading_plan_members").insert({ plan_id: data.id, user_id: me.id, church_id: me.church_id });
  revalidatePath("/dashboard/reading-plans");
  flash(p.churchWide ? "Plan started — the whole church has been invited." : "Plan started. Happy reading!");
  redirect(`/dashboard/reading-plans/${data.id}`);
}

/** Form fields: plan_id, join ("1" join / "0" leave) */
export async function joinReadingPlan(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const id = z.string().uuid().safeParse(formData.get("plan_id"));
  if (!me?.church_id || !id.success) return;
  const supabase = createClient();
  if (formData.get("join") === "1") await supabase.from("reading_plan_members").upsert({ plan_id: id.data, user_id: me.id, church_id: me.church_id }, { ignoreDuplicates: true });
  else await supabase.from("reading_plan_members").delete().eq("plan_id", id.data).eq("user_id", me.id);
  revalidatePath(`/dashboard/reading-plans/${id.data}`);
  revalidatePath("/dashboard/reading-plans");
}

/** Tick or untick a day. Form fields: plan_id, day, done ("1" | "0") */
export async function tickReadingDay(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const parsed = z.object({ id: z.string().uuid(), day: z.coerce.number().int().min(1).max(400) }).safeParse({ id: formData.get("plan_id"), day: formData.get("day") });
  if (!me?.church_id || !parsed.success) return;
  const supabase = createClient();
  if (formData.get("done") === "1") {
    await supabase.from("reading_plan_members").upsert({ plan_id: parsed.data.id, user_id: me.id, church_id: me.church_id }, { ignoreDuplicates: true });
    const { error } = await supabase.from("reading_progress").upsert({ plan_id: parsed.data.id, user_id: me.id, church_id: me.church_id, day: parsed.data.day }, { ignoreDuplicates: true });
    if (error) flash("Couldn't save that — please try again.", "error");
  } else {
    await supabase.from("reading_progress").delete().eq("plan_id", parsed.data.id).eq("user_id", me.id).eq("day", parsed.data.day);
  }
  revalidatePath(`/dashboard/reading-plans/${parsed.data.id}`);
  revalidatePath("/dashboard/reading-plans");
}

/** The plan's creator (or a pastor, for church-wide plans). Form fields: plan_id */
export async function deleteReadingPlan(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const id = z.string().uuid().safeParse(formData.get("plan_id"));
  if (!me?.church_id || !id.success) return;
  const { data } = await createClient().from("reading_plans").delete().eq("id", id.data).select("id");
  if (!data?.length) {
    flash("Couldn't delete that plan.", "error");
    return;
  }
  revalidatePath("/dashboard/reading-plans");
  flash("Plan deleted.");
  redirect("/dashboard/reading-plans");
}
