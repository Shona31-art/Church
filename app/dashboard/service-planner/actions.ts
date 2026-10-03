"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";

// All service-planner writes. Pastors and church admins only — re-checked in
// every action (server actions are callable directly) and again by RLS
// (service_plans_* / service_plan_items_write in service_booking_schema.sql).

export type FormResult = { error?: string; ok?: boolean } | null;

const DEFAULT_ITEMS = ["Worship", "Opening Prayer", "Offering", "7-Minute Word", "Sermon", "Announcements", "Closing Prayer"];

async function requirePlanner() {
  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role) || !me.church_id) return null;
  const access = await checkModuleAccess("service_planner");
  return access.allowed ? me : null;
}
const NOT_ALLOWED = { error: "Only pastors and church admins can edit service plans. If you are one, sign in again." };

const itemTitle = z.string().trim().min(1, "Give the item a name.").max(120, "Keep the item name under 120 characters.");
const uuid = z.string().uuid();

/** Form fields: title, service_date (YYYY-MM-DD), use_template ("on" | absent) */
export async function createPlan(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requirePlanner();
  if (!me) return NOT_ALLOWED;

  const parsed = z
    .object({
      title: z.string().trim().min(1, "Give the service a name.").max(120, "Keep the name under 120 characters."),
      serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the service date."),
    })
    .safeParse({ title: formData.get("title"), serviceDate: formData.get("service_date") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const supabase = createClient();
  const { data: plan, error } = await supabase
    .from("service_plans")
    .insert({ church_id: me.church_id, created_by: me.id, title: parsed.data.title, service_date: parsed.data.serviceDate })
    .select("id")
    .single();
  if (error || !plan) {
    console.error("[service-planner] create failed:", error?.message);
    return { error: "Couldn't create the service plan — please try again." };
  }

  if (formData.get("use_template") === "on") {
    const { error: itemsError } = await supabase
      .from("service_plan_items")
      .insert(DEFAULT_ITEMS.map((item_title, i) => ({ service_plan_id: plan.id, order_index: i, item_title })));
    // The plan itself saved, so carry on to it; the page explains what to do.
    if (itemsError) {
      console.error("[service-planner] template items failed:", itemsError.message);
      redirect(`/dashboard/service-planner/${plan.id}?template=failed`);
    }
  }

  redirect(`/dashboard/service-planner/${plan.id}`);
}

/** Form fields: plan_id, item_title */
export async function addItem(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requirePlanner();
  if (!me) return NOT_ALLOWED;

  const planId = uuid.safeParse(formData.get("plan_id"));
  const title = itemTitle.safeParse(formData.get("item_title"));
  if (!planId.success) return { error: "That service plan couldn't be found." };
  if (!title.success) return { error: title.error.issues[0]?.message };

  const supabase = createClient();
  // Append after the current last item (max, not count, so gaps left by
  // removed items don't cause duplicates).
  const { data: last } = await supabase
    .from("service_plan_items")
    .select("order_index")
    .eq("service_plan_id", planId.data)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("service_plan_items")
    .insert({ service_plan_id: planId.data, order_index: (last?.order_index ?? -1) + 1, item_title: title.data });
  if (error) {
    console.error("[service-planner] add item failed:", error.message);
    return { error: "Couldn't add that item — please try again." };
  }

  revalidatePath(`/dashboard/service-planner/${planId.data}`);
  return { ok: true };
}

/** Form fields: plan_id, item_id, assigned_to ("" = unassigned) */
export async function assignItem(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requirePlanner();
  if (!me) return NOT_ALLOWED;

  const planId = uuid.safeParse(formData.get("plan_id"));
  const itemId = uuid.safeParse(formData.get("item_id"));
  const assignedRaw = formData.get("assigned_to") || null;
  const assignedTo = assignedRaw === null ? null : uuid.safeParse(assignedRaw);
  if (!planId.success || !itemId.success || (assignedTo && !assignedTo.success)) return { error: "Please choose someone from the list." };

  const supabase = createClient();
  if (assignedTo?.success) {
    // RLS doesn't restrict who can be assigned, so check they're in this church.
    const { data: person } = await supabase
      .from("app_users")
      .select("id")
      .eq("id", assignedTo.data)
      .eq("church_id", me.church_id)
      .maybeSingle();
    if (!person) return { error: "That person isn't a member of your church." };
  }

  const { data: updated, error } = await supabase
    .from("service_plan_items")
    .update({ assigned_to: assignedTo?.success ? assignedTo.data : null })
    .eq("id", itemId.data)
    .eq("service_plan_id", planId.data)
    .select("id");
  if (error) {
    console.error("[service-planner] assign failed:", error.message);
    return { error: "Couldn't save — please try again." };
  }
  if (!updated?.length) return { error: "That item no longer exists — refresh the page." };

  revalidatePath(`/dashboard/service-planner/${planId.data}`);
  return { ok: true };
}

/** Form fields: plan_id, item_id */
export async function removeItem(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requirePlanner();
  if (!me) return NOT_ALLOWED;

  const planId = uuid.safeParse(formData.get("plan_id"));
  const itemId = uuid.safeParse(formData.get("item_id"));
  if (!planId.success || !itemId.success) return { error: "That item couldn't be found." };

  const supabase = createClient();
  const { error } = await supabase
    .from("service_plan_items")
    .delete()
    .eq("id", itemId.data)
    .eq("service_plan_id", planId.data);
  if (error) {
    console.error("[service-planner] remove failed:", error.message);
    return { error: "Couldn't remove that item — please try again." };
  }

  revalidatePath(`/dashboard/service-planner/${planId.data}`);
  return { ok: true };
}

/**
 * Form fields: plan_id, from ("draft" | "published" — what the user saw), to.
 * Only applies if the status is still `from`, so two people clicking at once
 * can't silently undo each other.
 */
export async function setPlanStatus(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requirePlanner();
  if (!me) return NOT_ALLOWED;

  const status = z.enum(["draft", "published"]);
  const parsed = z
    .object({ planId: uuid, from: status, to: status })
    .safeParse({ planId: formData.get("plan_id"), from: formData.get("from"), to: formData.get("to") });
  if (!parsed.success) return { error: "Unknown status." };
  const { planId, from, to } = parsed.data;

  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from("service_plans")
    .update({ status: to })
    .eq("id", planId)
    .eq("church_id", me.church_id)
    .eq("status", from)
    .select("id");
  if (error) {
    console.error("[service-planner] status change failed:", error.message);
    return { error: "Couldn't change the status — please try again." };
  }

  revalidatePath(`/dashboard/service-planner/${planId}`);
  revalidatePath("/dashboard/service-planner");
  if (!updated?.length) return { error: "Someone else changed this plan's status just now. The page shows the latest." };
  return { ok: true };
}
