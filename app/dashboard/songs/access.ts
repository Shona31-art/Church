import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { canManageSongs } from "@/lib/songs";

/** The signed-in person, their church's worship-team department, and whether they may edit songs. */
export async function songAccess() {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return null;
  const { data: settings, error } = await createClient().from("church_song_settings").select("worship_department_id").eq("church_id", me.church_id).maybeSingle();
  // 42P01: songs.sql hasn't been run yet.
  const notSetUp = error?.code === "42P01" || /church_song_settings/.test(error?.message ?? "");
  const worshipDepartmentId = settings?.worship_department_id ?? null;
  return { me: me as typeof me & { church_id: string }, worshipDepartmentId, canManage: canManageSongs(me, worshipDepartmentId), notSetUp };
}
