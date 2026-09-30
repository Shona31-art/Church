"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function createEvent(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor", "department_leader"].includes(me.role)) {
    return { error: "You don't have permission to create events." };
  }

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "");
  const location = String(formData.get("location") || "");
  const category = String(formData.get("category") || "");
  const startTime = String(formData.get("start_time") || "");
  const endTime = String(formData.get("end_time") || "") || null;
  const departmentIdRaw = String(formData.get("department_id") || "");

  if (!title || !startTime) {
    return { error: "Title and start time are required." };
  }

  const departmentId = me.role === "department_leader" ? me.department_id : departmentIdRaw || null;

  const supabase = createClient();
  const { error } = await supabase.from("events").insert({
    church_id: me.church_id,
    department_id: departmentId,
    created_by: me.id,
    title,
    description,
    location,
    category,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return { error: "Couldn't create the event — try again." };

  redirect("/dashboard/calendar");
}
