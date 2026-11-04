import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrls } from "@/lib/avatars";
import type { ChannelPerson } from "./ChannelForm";

/** Everyone active in the church, with photos, for the channel member picker. */
export async function loadChannelPeople(churchId: string): Promise<ChannelPerson[]> {
  const { data } = await createClient().from("app_users").select("*").eq("church_id", churchId).neq("status", "disabled").order("name");
  // Record-only members (record_members.sql) don't use the app, so they aren't in chats.
  const people = ((data ?? []) as { id: string; name: string; record_only?: boolean }[]).filter((p) => !p.record_only);
  const photos = await getAvatarUrls(people.map((p) => p.id));
  return people.map((p) => ({ id: p.id, name: p.name, photoUrl: photos.get(p.id) ?? null }));
}
