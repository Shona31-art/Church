"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { flash } from "@/lib/flash";
import { can } from "@/lib/permissions";
import { localInputToUtcIso } from "@/lib/format";
import { EVENT_CATEGORIES } from "@/lib/events";
import { FormState, SESSION_EXPIRED, formValues, invalid, optionalField } from "@/lib/forms";

// Event lifecycle: create → edit → cancel (kept, RSVPs closed) or delete.
// Organisers manage their own events; pastors and admins manage all events in
// their church. Leaders create department events only (events_* policies).

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.");

const EventSchema = z
  .object({
    title: z.string().trim().min(2, "Give the event a title.").max(150, "Keep the title under 150 characters."),
    description: z.string().trim().max(5000, "Keep the description under 5,000 characters.").optional(),
    location: z.string().trim().max(200, "Keep the location under 200 characters.").optional(),
    category: z.enum(EVENT_CATEGORIES, { message: "Choose a type of event." }),
    startTime: localDateTime,
    endTime: localDateTime.optional(),
    departmentId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
  })
  .refine((e) => !e.endTime || e.endTime >= e.startTime, { message: "The end must be after the start.", path: ["endTime"] });

async function requireOrganiser(): Promise<AppUser | null> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "createEvents")) return null;
  return (await checkModuleAccess("calendar")).allowed ? me : null;
}

function refresh(id?: string) {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/dashboard/calendar/${id}`);
}

/** Create or edit. Form fields: event_id? + updated_at? (edit), title, description?, location?, category, start_time, end_time?, department_id? */
export async function saveEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireOrganiser();
  if (!me) return { error: "Only pastors, church admins and department leaders can create events. If you are one, sign in again." };

  const parsed = EventSchema.safeParse({
    title: formData.get("title"),
    description: optionalField(formData, "description"),
    location: optionalField(formData, "location"),
    category: formData.get("category"),
    startTime: formData.get("start_time"),
    endTime: optionalField(formData, "end_time"),
    departmentId: formData.get("department_id") ?? "",
  });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    // Map schema keys to form field names for inline errors.
    if (result?.fieldErrors) {
      const map: Record<string, string> = { startTime: "start_time", endTime: "end_time", departmentId: "department_id" };
      result.fieldErrors = Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [map[k] ?? k, v]));
    }
    return result;
  }
  const input = parsed.data;
  const values = formValues(formData);

  const startIso = localInputToUtcIso(input.startTime);
  const endIso = input.endTime ? localInputToUtcIso(input.endTime) : null;
  if (!startIso) return { error: "Please fix the highlighted fields.", fieldErrors: { start_time: "That date doesn't exist." }, values };

  const churchWide = can(me.role, "postChurchWide");
  const departmentId = churchWide ? input.departmentId : me.department_id;
  if (!churchWide && !departmentId) return { error: "You're not assigned to a department yet — ask a church admin to assign you.", values };

  const row = {
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    category: input.category,
    start_time: startIso,
    end_time: endIso,
    department_id: departmentId,
  };
  const supabase = createClient();
  const existingId = formData.get("event_id");

  if (existingId) {
    const id = z.string().uuid().safeParse(existingId);
    const updatedAt = String(formData.get("updated_at") ?? "");
    if (!id.success || !updatedAt) return { error: "That event couldn't be found.", values };
    const { data: updated, error } = await supabase
      .from("events")
      .update(row)
      .eq("id", id.data)
      .eq("church_id", me.church_id)
      .eq("updated_at", updatedAt)
      .select("id");
    if (error) {
      console.error("[calendar] update failed:", error.message);
      return { error: "Couldn't save the event — please try again.", values };
    }
    if (!updated?.length) return { error: "Someone else changed this event while you were editing, or you can no longer edit it. Reload to see the latest.", values };
    refresh(id.data);
    flash("Event updated.");
    redirect(`/dashboard/calendar/${id.data}`);
  }

  const { data: created, error } = await supabase
    .from("events")
    .insert({ ...row, church_id: me.church_id, created_by: me.id })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[calendar] create failed:", error?.message);
    return { error: "Couldn't create the event — please try again.", values };
  }
  refresh();
  flash("Event created.");
  redirect(`/dashboard/calendar/${created.id}`);
}

/** Form fields: event_id, cancel ("true" | "false"). Cancelling keeps the event (and its RSVPs) visible, marked cancelled. */
export async function setEventCancelled(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireOrganiser();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("event_id"));
  if (!id.success) return { error: "That event couldn't be found." };
  const cancel = formData.get("cancel") === "true";

  const { data: updated, error } = await createClient()
    .from("events")
    .update(cancel ? { cancelled_at: new Date().toISOString(), cancelled_by: me.id } : { cancelled_at: null, cancelled_by: null })
    .eq("id", id.data)
    .eq("church_id", me.church_id)
    .select("id");
  if (error || !updated?.length) {
    if (error) console.error("[calendar] cancel failed:", error.message);
    return { error: "Couldn't update this event. You may not have permission, or it was deleted." };
  }
  refresh(id.data);
  flash(cancel ? "Event cancelled. Anyone who opens it will see it's off." : "Event reinstated.");
  return { ok: true };
}

/** Form fields: event_id */
export async function deleteEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireOrganiser();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("event_id"));
  if (!id.success) return { error: "That event couldn't be found." };

  const { data: deleted, error } = await createClient().from("events").delete().eq("id", id.data).eq("church_id", me.church_id).select("id");
  if (error || !deleted?.length) {
    if (error) console.error("[calendar] delete failed:", error.message);
    return { error: "Couldn't delete this event. You may not have permission, or it was already deleted." };
  }
  refresh();
  flash("Event deleted.");
  redirect("/dashboard/calendar");
}

/** Anyone in the church. Form fields: event_id, status ("going" | "maybe" | "declined" | "none"). */
export async function rsvp(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  const parsed = z
    .object({ eventId: z.string().uuid(), status: z.enum(["going", "maybe", "declined", "none"]) })
    .safeParse({ eventId: formData.get("event_id"), status: formData.get("status") });
  if (!parsed.success) return { error: "That response isn't valid." };

  const supabase = createClient();
  const { error } =
    parsed.data.status === "none"
      ? await supabase.from("event_rsvps").delete().eq("event_id", parsed.data.eventId).eq("user_id", me.id)
      : await supabase
          .from("event_rsvps")
          .upsert({ event_id: parsed.data.eventId, user_id: me.id, status: parsed.data.status }, { onConflict: "event_id,user_id" });
  if (error) {
    console.error("[calendar] rsvp failed:", error.message);
    // RLS refuses RSVPs to cancelled events or events you can't see.
    return { error: "Couldn't save your response. The event may have been cancelled — refresh to check." };
  }
  refresh(parsed.data.eventId);
  return { ok: true };
}
