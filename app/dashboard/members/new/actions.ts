"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";

export async function addMember(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor", "super_admin"].includes(me.role)) {
    return { error: "You don't have permission to add members." };
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const role = String(formData.get("role") || "member");
  const departmentId = String(formData.get("department_id") || "") || null;

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  // Creating another person's login requires the admin (service role)
  // client — a regular user can never do this for someone else, by design.
  const admin = createAdminClient();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email);

  if (error || !invited.user) {
    return { error: error?.message || "Could not send invite — check the email address and try again." };
  }

  const { error: insertError } = await admin.from("app_users").insert({
    id: invited.user.id,
    church_id: me.church_id,
    name,
    email,
    phone,
    role,
    department_id: departmentId,
    status: "invited",
  });

  if (insertError) {
    return { error: insertError.message };
  }

  redirect("/dashboard/members");
}
