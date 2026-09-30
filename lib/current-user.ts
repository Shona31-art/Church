import { createClient } from "@/lib/supabase/server";

export async function getCurrentAppUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, church_id, role, name, email, department_id")
    .eq("id", user.id)
    .single();

  return appUser;
}
