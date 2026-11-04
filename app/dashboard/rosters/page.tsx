import Link from "next/link";
import { Flame, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate, todayInAppZone } from "@/lib/format";
import { churchPeople } from "@/lib/children";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { TeamForm } from "./RosterForms";
import { requestSwap, takeSwap } from "./actions";

export const metadata = { title: "Rosters" };

export default async function RostersPage() {
  const gate = await moduleGate("rosters");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const shepherd = can(me.role, "planServices");
  const supabase = createClient();
  const today = todayInAppZone();
  const [{ data: teams }, { data: myTeams }, { data: duties }] = await Promise.all([
    supabase.from("roster_teams").select("id, name, description, leader_id, leader:app_users!roster_teams_leader_id_fkey(name)").eq("church_id", me.church_id).order("name"),
    supabase.from("roster_team_members").select("team_id").eq("user_id", me.id),
    supabase
      .from("roster_duties")
      .select("id, team_id, duty_date, role, user_id, swap_requested, swap_note, person:app_users!roster_duties_user_id_fkey(name)")
      .eq("church_id", me.church_id)
      .gte("duty_date", today)
      .order("duty_date")
      .limit(500),
  ]);
  const teamName = (id: string) => (teams ?? []).find((t) => t.id === id)?.name ?? "Team";
  const inTeam = new Set((myTeams ?? []).map((t) => t.team_id));
  const all = (duties ?? []) as any[];
  const mine = all.filter((d) => d.user_id === me.id);
  const swaps = all.filter((d) => d.swap_requested && d.user_id !== me.id && (inTeam.has(d.team_id) || shepherd));
  const people = shepherd ? await churchPeople(me.church_id!) : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader back={{ href: "/dashboard", label: "Home" }} title="Rosters" description="Who serves when — with a reminder the day before, and easy swaps." />
      {shepherd && <TeamForm people={people} />}

      <Section title="My duties">
        {!mine.length ? (
          <p className="text-sm text-ink/60">You&apos;re not on any roster coming up.</p>
        ) : (
          <ul className="divide-y divide-line">
            {mine.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {formatDate(d.duty_date, { month: "long" })} · {teamName(d.team_id)}
                  </p>
                  <p className="text-sm text-ink/60">{d.role ?? "On duty"}</p>
                </div>
                {d.swap_requested ? (
                  <>
                    <StatusBadge tone="warning">Swap asked</StatusBadge>
                    <form action={requestSwap}>
                      <input type="hidden" name="duty_id" value={d.id} />
                      <input type="hidden" name="cancel" value="1" />
                      <PendingButton className="btn-ghost btn-sm" pendingLabel="…">I can make it</PendingButton>
                    </form>
                  </>
                ) : (
                  <details className="w-full sm:w-auto">
                    <summary className="btn-secondary btn-sm cursor-pointer list-none">
                      <Repeat aria-hidden className="h-4 w-4" /> Can&apos;t make it
                    </summary>
                    <form action={requestSwap} className="mt-2 flex gap-2">
                      <input type="hidden" name="duty_id" value={d.id} />
                      <input name="note" maxLength={300} className="input" placeholder="Note for the team (optional)" aria-label="Note for the team" />
                      <PendingButton className="btn-primary btn-sm shrink-0" pendingLabel="…">Ask for a swap</PendingButton>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {swaps.length > 0 && (
        <Section title="Can you help? Swaps needed">
          <ul className="divide-y divide-line">
            {swaps.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {formatDate(d.duty_date, { month: "long" })} · {teamName(d.team_id)}
                    {d.role ? ` · ${d.role}` : ""}
                  </p>
                  <p className="text-sm text-ink/60">
                    {d.person?.name ?? "Someone"} can&apos;t make it{d.swap_note ? `: “${d.swap_note}”` : ""}
                  </p>
                </div>
                <form action={takeSwap}>
                  <input type="hidden" name="duty_id" value={d.id} />
                  <PendingButton className="btn-primary btn-sm" pendingLabel="…">I&apos;ll take it</PendingButton>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section aria-labelledby="teams-h" className="space-y-3">
        <h2 id="teams-h" className="text-lg font-semibold">Teams</h2>
        {!(teams ?? []).length ? (
          <EmptyState icon={Flame} title="No teams yet" description={shepherd ? "Create your ushers, worship, sound and kids' church teams." : "Your pastors haven't set up any teams yet."} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(teams ?? []).map((t: any) => {
              const next = all.find((d) => d.team_id === t.id);
              return (
                <li key={t.id}>
                  <Link href={`/dashboard/rosters/${t.id}`} className="card-elevated block h-full rounded-2xl p-4 hover:border-gold">
                    <p className="font-semibold">{t.name}</p>
                    {t.leader?.name && <p className="text-xs text-ink/60">Led by {t.leader.name}</p>}
                    <p className="mt-2 text-sm text-ink/70">{next ? `Next: ${formatDate(next.duty_date)} — ${next.person?.name ?? "nobody yet"}` : "Nothing planned yet"}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
