import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayInAppZone } from "@/lib/format";
import { ageOn } from "@/lib/birthdays";
import type { ChildRow } from "@/components/members/ChildrenList";

/**
 * A member's children for display (supabase/member_children.sql), youngest
 * last. Returns null when the table doesn't exist yet (migration not run), so
 * callers can hide the section instead of breaking the page.
 */
export async function loadChildren(parentId: string): Promise<ChildRow[] | null> {
  const { data, error } = await createClient()
    .from("member_children")
    .select("id, name, birth_date")
    .eq("user_id", parentId)
    .order("birth_date", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) {
    if (error.code !== "42P01") console.error("[children] load failed:", error.message);
    return null;
  }
  const [y, m, d] = todayInAppZone().split("-").map(Number);
  const today = new Date(y, m - 1, d);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    birthDate: c.birth_date,
    birthdayLabel: c.birth_date ? formatDate(c.birth_date, { weekday: undefined }) : null,
    age: c.birth_date ? ageOn(c.birth_date, today) : null,
  }));
}
