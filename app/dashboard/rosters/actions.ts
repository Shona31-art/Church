"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";

// Volunteer rosters (church_life.sql). Pastors/admins run every team; a
// team's leader runs their own. RLS checks the same (can_manage_roster_team).

const refresh = (teamId?: string) => {
  revalidatePath("/dashboard/rosters");
  if (teamId) revalidatePath(`/dashboard/rosters/${teamId}`);
};

/** Pastors. Form fields: name, description?, leader_id? */
export async function createTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "planServices")) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("rosters")).allowed) return { error: "Rosters aren't on your church's plan." };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name the team.").max(80),
      description: z.string().trim().max(500).transform((v) => v || null),
      leaderId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
    })
    .safeParse({ name: formData.get("name") ?? "", description: formData.get("description") ?? "", leaderId: formData.get("leader_id") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: formValues(formData) };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("roster_teams")
    .insert({ church_id: me.church_id, name: parsed.data.name, description: parsed.data.description, leader_id: parsed.data.leaderId })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create the team — please try again.", values: formValues(formData) };
  if (parsed.data.leaderId) await supabase.from("roster_team_members").insert({ team_id: data.id, user_id: parsed.data.leaderId, church_id: me.church_id });
  refresh();
  flash(`${parsed.data.name} created. Add the people on the team next.`);
  redirect(`/dashboard/rosters/${data.id}`);
}

/** Pastors. Form fields: team_id, leader_id? */
export async function setTeamLeader(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const team = z.string().uuid().safeParse(formData.get("team_id"));
  const leader = z.union([z.string().uuid(), z.literal("")]).safeParse(formData.get("leader_id") ?? "");
  if (!me?.church_id || !team.success || !leader.success || !can(me.role, "planServices")) return;
  await createClient().from("roster_teams").update({ leader_id: leader.data || null }).eq("id", team.data).eq("church_id", me.church_id);
  refresh(team.data);
  flash("Team leader saved.");
}

/** Pastors. Form fields: team_id */
export async function deleteTeam(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const team = z.string().uuid().safeParse(formData.get("team_id"));
  if (!me?.church_id || !team.success || !can(me.role, "planServices")) return;
  await createClient().from("roster_teams").delete().eq("id", team.data).eq("church_id", me.church_id);
  refresh();
  flash("Team deleted.");
  redirect("/dashboard/rosters");
}

/** Team managers. Form fields: team_id, user_id, add ("1" | "0") */
export async function setTeamMember(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const p = z.object({ team: z.string().uuid(), user: z.string().uuid() }).safeParse({ team: formData.get("team_id"), user: formData.get("user_id") });
  if (!me?.church_id || !p.success) return;
  const supabase = createClient();
  const { error } =
    formData.get("add") === "1"
      ? await supabase.from("roster_team_members").upsert({ team_id: p.data.team, user_id: p.data.user, church_id: me.church_id }, { ignoreDuplicates: true })
      : await supabase.from("roster_team_members").delete().eq("team_id", p.data.team).eq("user_id", p.data.user);
  if (error) flash("Couldn't change the team — only pastors and the team leader can.", "error");
  refresh(p.data.team);
}

const addSchema = z.object({
  team: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  role: z.string().trim().max(80).transform((v) => v || null),
  person: z.string(),
  weeks: z.coerce.number().int().min(1).max(26),
});

/**
 * Team managers: put people on duty. Repeats weekly; "rotate" takes turns
 * through the team. Form fields: team_id, duty_date, role?, user_id ("" | uuid | "rotate"), weeks
 */
export async function addDuties(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: SESSION_EXPIRED };
  const p = addSchema.safeParse({ team: formData.get("team_id"), date: formData.get("duty_date") ?? "", role: formData.get("role") ?? "", person: formData.get("user_id") ?? "", weeks: formData.get("weeks") ?? 1 });
  if (!p.success) return { error: p.error.issues[0]?.message, values: formValues(formData) };
  const supabase = createClient();
  let rotation: string[] = [];
  if (p.data.person === "rotate") {
    const { data } = await supabase.from("roster_team_members").select("user_id, app_users(name)").eq("team_id", p.data.team);
    rotation = ((data ?? []) as any[]).sort((a, b) => (a.app_users?.name ?? "").localeCompare(b.app_users?.name ?? "")).map((m) => m.user_id);
    if (!rotation.length) return { error: "Add people to the team first, then they can take turns.", values: formValues(formData) };
  }
  const single = z.string().uuid().safeParse(p.data.person);
  const base = Date.parse(`${p.data.date}T12:00:00Z`);
  const rows = Array.from({ length: p.data.weeks }, (_, i) => ({
    team_id: p.data.team,
    church_id: me.church_id,
    duty_date: new Date(base + i * 7 * 86_400_000).toISOString().slice(0, 10),
    role: p.data.role,
    user_id: rotation.length ? rotation[i % rotation.length] : single.success ? single.data : null,
    created_by: me.id,
  }));
  const { error } = await supabase.from("roster_duties").insert(rows);
  if (error) {
    console.error("[rosters] add duties failed:", error.message);
    return { error: "Couldn't add those — only pastors and the team leader can plan this team.", values: formValues(formData) };
  }
  refresh(p.data.team);
  flash(rows.length === 1 ? "Added to the roster." : `${rows.length} weeks added to the roster.`);
  return { ok: true };
}

/** Team managers: change who's on a duty, or remove it. Form fields: duty_id, team_id, user_id? | remove="1" */
export async function updateDuty(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const p = z.object({ duty: z.string().uuid(), team: z.string().uuid() }).safeParse({ duty: formData.get("duty_id"), team: formData.get("team_id") });
  if (!me?.church_id || !p.success) return;
  const supabase = createClient();
  if (formData.get("remove") === "1") await supabase.from("roster_duties").delete().eq("id", p.data.duty);
  else {
    const user = z.union([z.string().uuid(), z.literal("")]).safeParse(formData.get("user_id") ?? "");
    if (!user.success) return;
    await supabase.from("roster_duties").update({ user_id: user.data || null, swap_requested: false, swap_note: null, reminded_at: null }).eq("id", p.data.duty);
  }
  refresh(p.data.team);
}

/** The person on duty: ask for a swap or take the request back. Form fields: duty_id, note?, cancel? */
export async function requestSwap(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const duty = z.string().uuid().safeParse(formData.get("duty_id"));
  if (!me?.church_id || !duty.success) return;
  const { error } = await createClient().rpc("request_roster_swap", { duty: duty.data, note: String(formData.get("note") ?? "").slice(0, 300) || null, cancel: formData.get("cancel") === "1" });
  if (error) flash(error.message.replace(/^.*?: /, ""), "error");
  else flash(formData.get("cancel") === "1" ? "Swap request taken back — you're still on." : "Your team has been asked. You stay on until someone takes it.");
  refresh();
}

/** A team member takes a duty that's up for swapping. Form fields: duty_id */
export async function takeSwap(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const duty = z.string().uuid().safeParse(formData.get("duty_id"));
  if (!me?.church_id || !duty.success) return;
  const { error } = await createClient().rpc("take_roster_swap", { duty: duty.data });
  if (error) flash(error.message.replace(/^.*?: /, ""), "error");
  else flash("It's yours — thank you for stepping in!");
  refresh();
}
