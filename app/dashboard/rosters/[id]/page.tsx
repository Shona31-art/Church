import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate, todayInAppZone } from "@/lib/format";
import { churchPeople } from "@/lib/children";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { DutyForm } from "../RosterForms";
import { deleteTeam, setTeamLeader, setTeamMember, updateDuty } from "../actions";

export const metadata = { title: "Team roster" };

function nextSunday(today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  return new Date(d.getTime() + ((7 - d.getUTCDay()) % 7) * 86_400_000).toISOString().slice(0, 10);
}

export default async function TeamPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("rosters");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const { data: team } = await supabase.from("roster_teams").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!team) notFound();
  const shepherd = can(me.role, "planServices");
  const manage = shepherd || team.leader_id === me.id;
  const today = todayInAppZone();
  const [{ data: memberRows }, { data: duties }, people] = await Promise.all([
    supabase.from("roster_team_members").select("user_id, app_users(name)").eq("team_id", team.id),
    supabase.from("roster_duties").select("id, duty_date, role, user_id, swap_requested, person:app_users!roster_duties_user_id_fkey(name)").eq("team_id", team.id).gte("duty_date", today).order("duty_date").order("role").limit(300),
    manage ? churchPeople(me.church_id!) : Promise.resolve([]),
  ]);
  const members = ((memberRows ?? []) as any[]).map((m) => ({ id: m.user_id as string, name: (m.app_users?.name as string) ?? "Former member" })).sort((a, b) => a.name.localeCompare(b.name));
  const memberIds = new Set(members.map((m) => m.id));
  const notOnTeam = people.filter((p) => !memberIds.has(p.id));

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader back={{ href: "/dashboard/rosters", label: "Rosters" }} title={team.name} description={team.description ?? undefined} />

      <Section title="Coming up">
        {!(duties ?? []).length ? (
          <p className="text-sm text-ink/60">Nothing planned yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {((duties ?? []) as any[]).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {formatDate(d.duty_date)}
                    {d.role ? ` · ${d.role}` : ""}
                  </p>
                  {!manage && <p className="text-sm text-ink/60">{d.person?.name ?? "Nobody yet"}</p>}
                </div>
                {d.swap_requested && <StatusBadge tone="warning">Swap asked</StatusBadge>}
                {manage ? (
                  <>
                    <form action={updateDuty} className="flex gap-2">
                      <input type="hidden" name="duty_id" value={d.id} />
                      <input type="hidden" name="team_id" value={team.id} />
                      <select name="user_id" defaultValue={d.user_id ?? ""} className="input py-1.5 text-sm" aria-label={`Who serves on ${formatDate(d.duty_date)}`}>
                        <option value="">Nobody yet</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                        {d.user_id && !memberIds.has(d.user_id) && <option value={d.user_id}>{d.person?.name ?? "Someone"}</option>}
                      </select>
                      <PendingButton className="btn-secondary btn-sm" pendingLabel="…">Save</PendingButton>
                    </form>
                    <form action={updateDuty}>
                      <input type="hidden" name="duty_id" value={d.id} />
                      <input type="hidden" name="team_id" value={team.id} />
                      <input type="hidden" name="remove" value="1" />
                      <button type="submit" className="btn-ghost btn-sm" aria-label={`Remove the duty on ${formatDate(d.duty_date)}`}>
                        ✕
                      </button>
                    </form>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {manage && (
        <Section title="Add to the roster">
          <DutyForm teamId={team.id} members={members} nextSunday={nextSunday(today)} />
        </Section>
      )}

      <Section title={`People on the team (${members.length})`}>
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.id} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm">
              {m.name}
              {m.id === team.leader_id && <span className="text-xs text-gold-deep"> · leader</span>}
              {manage && (
                <form action={setTeamMember}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <input type="hidden" name="user_id" value={m.id} />
                  <input type="hidden" name="add" value="0" />
                  <button type="submit" className="ml-1 text-ink/40 hover:text-ink" aria-label={`Take ${m.name} off the team`}>
                    ✕
                  </button>
                </form>
              )}
            </li>
          ))}
          {!members.length && <li className="text-sm text-ink/60">No one yet.</li>}
        </ul>
        {manage && notOnTeam.length > 0 && (
          <form action={setTeamMember} className="mt-4 flex gap-2">
            <input type="hidden" name="team_id" value={team.id} />
            <input type="hidden" name="add" value="1" />
            <select name="user_id" className="input" aria-label="Add someone to the team" required defaultValue="">
              <option value="" disabled>
                Add someone…
              </option>
              {notOnTeam.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <PendingButton className="btn-secondary shrink-0" pendingLabel="…">Add</PendingButton>
          </form>
        )}
      </Section>

      {shepherd && (
        <Section title="Team settings">
          <form action={setTeamLeader} className="flex flex-wrap gap-2">
            <input type="hidden" name="team_id" value={team.id} />
            <select name="leader_id" defaultValue={team.leader_id ?? ""} className="input max-w-xs" aria-label="Team leader">
              <option value="">No leader</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <PendingButton className="btn-secondary" pendingLabel="…">Save leader</PendingButton>
          </form>
          <form action={deleteTeam} className="mt-4">
            <input type="hidden" name="team_id" value={team.id} />
            <ConfirmSubmitButton title={`Delete ${team.name}?`} message="The team, its people and its roster will be removed." confirmLabel="Delete team" pendingLabel="Deleting…">
              Delete team
            </ConfirmSubmitButton>
          </form>
        </Section>
      )}
    </div>
  );
}
