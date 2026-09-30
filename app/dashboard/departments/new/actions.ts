"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function createDepartment(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return { error: "Only church admins and pastors can create departments." };
  }

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Please enter a department name." };

  const supabase = createClient();
  const { data: department, error } = await supabase
    .from("departments")
    .insert({ church_id: me.church_id, name })
    .select("id")
    .single();

  if (error || !department) {
    return { error: error?.message.includes("duplicate") ? "A department with this name already exists." : "Couldn't create department — try again." };
  }

  // Give every department its own chat channel automatically.
  await supabase.from("chat_channels").insert({
    church_id: me.church_id,
    department_id: department.id,
    name,
  });

  redirect("/dashboard/departments");
}
