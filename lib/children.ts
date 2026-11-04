import "server-only";
import { createClient } from "@/lib/supabase/server";
import { birthdayLabel } from "@/lib/birthdays";
import type { ChildRow, ParentRef, Person } from "@/components/members/ChildrenList";

// Members' children (supabase/member_children.sql, member_children_v2.sql).
// Birthdays are shown as day and month only — never the year or age.

const V2 =
  "id, name, birth_date, user_id, mother_id, father_id, mother_name, father_name, mother:app_users!member_children_mother_id_fkey(name), father:app_users!member_children_father_id_fkey(name)";
const V1 = "id, name, birth_date, user_id";

type Raw = {
  id: string;
  name: string;
  birth_date: string | null;
  user_id: string;
  mother_id?: string | null;
  father_id?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
  mother?: { name: string } | null;
  father?: { name: string } | null;
};

function parent(id: string | null | undefined, joined: { name: string } | null | undefined, typed: string | null | undefined): ParentRef {
  if (id) return { id, name: joined?.name ?? "Former member" };
  return typed ? { id: null, name: typed } : null;
}

export function toChildRow(c: Raw): ChildRow {
  return {
    id: c.id,
    name: c.name,
    birthDate: c.birth_date,
    birthdayLabel: c.birth_date ? birthdayLabel(c.birth_date) : null,
    ownerId: c.user_id,
    mother: parent(c.mother_id, c.mother, c.mother_name),
    father: parent(c.father_id, c.father, c.father_name),
  };
}

/** Rows for a query, falling back to the first version of the table (no parents) before member_children_v2.sql. */
async function query(build: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<ChildRow[] | null> {
  let { data, error } = await build(V2);
  if (error && error.code !== "42P01") ({ data, error } = await build(V1));
  if (error) {
    if (error.code !== "42P01") console.error("[children] load failed:", error.message);
    return null; // table missing: callers hide the section
  }
  return ((data ?? []) as Raw[]).map(toChildRow);
}

/**
 * A member's children for display: ones they added, and ones where they're
 * the mother or father. Returns null when the table doesn't exist yet.
 */
export async function loadChildren(parentId: string): Promise<ChildRow[] | null> {
  const supabase = createClient();
  const rows = await query((columns) => {
    const q = supabase.from("member_children").select(columns);
    return (columns === V2 ? q.or(`user_id.eq.${parentId},mother_id.eq.${parentId},father_id.eq.${parentId}`) : q.eq("user_id", parentId))
      .order("birth_date", { ascending: true, nullsFirst: false })
      .order("created_at");
  });
  return rows;
}

/** Every child in the church (pastors and church admins: RLS shows them all), by name. */
export async function loadChurchChildren(): Promise<ChildRow[] | null> {
  const supabase = createClient();
  return query((columns) => supabase.from("member_children").select(columns).order("name").limit(1000));
}

/** The church's active members, for choosing a mother or father. */
export async function churchPeople(churchId: string): Promise<Person[]> {
  const { data } = await createClient().from("app_users").select("id, name").eq("church_id", churchId).eq("status", "active").order("name").limit(2000);
  return (data ?? []) as Person[];
}
