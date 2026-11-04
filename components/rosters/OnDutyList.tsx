import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * Who's on duty, from the volunteer rosters (church_life.sql), for the
 * Service Planner (one service date) and a department (its people, the next
 * few weeks). Renders nothing when rosters aren't on the plan or there's
 * nothing to show — so the page reads the same as before.
 */
export async function OnDutyList({
  churchId,
  date,
  from,
  to,
  userIds,
  empty,
}: {
  churchId: string;
  /** One date (YYYY-MM-DD) … */
  date?: string;
  /** … or a range. */
  from?: string;
  to?: string;
  /** Only these people (e.g. a department's members). */
  userIds?: string[];
  /** Text when nobody is rostered; omit to render nothing. */
  empty?: string;
}) {
  if (!(await checkModuleAccess("rosters")).allowed) return null;
  if (userIds && !userIds.length) return null;
  let q = createClient()
    .from("roster_duties")
    .select("id, duty_date, role, user_id, swap_requested, roster_teams(id, name), person:app_users!roster_duties_user_id_fkey(name)")
    .eq("church_id", churchId)
    .order("duty_date")
    .limit(200);
  if (date) q = q.eq("duty_date", date);
  if (from) q = q.gte("duty_date", from);
  if (to) q = q.lte("duty_date", to);
  if (userIds) q = q.in("user_id", userIds);
  const { data, error } = await q;
  if (error) return null; // rosters not installed yet
  const duties = (data ?? []) as any[];
  if (!duties.length) return empty ? <p className="text-sm text-ink/60">{empty}</p> : null;

  type Group = { id: string; name: string; rows: any[] };
  const byTeam = new Map<string, Group>();
  for (const d of duties) {
    const key = `${date ? "" : d.duty_date}|${d.roster_teams?.id ?? "?"}`;
    const g: Group = byTeam.get(key) ?? { id: d.roster_teams?.id ?? "", name: `${date ? "" : `${formatDate(d.duty_date)} · `}${d.roster_teams?.name ?? "Team"}`, rows: [] };
    g.rows.push(d);
    byTeam.set(key, g);
  }
  return (
    <ul className="space-y-3">
      {[...byTeam.values()].map((g) => (
        <li key={g.name + g.id}>
          <Link href={`/dashboard/rosters/${g.id}`} className="text-sm font-semibold hover:underline">
            {g.name}
          </Link>
          <ul className="mt-1 space-y-0.5 text-sm">
            {g.rows.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="text-ink/60">{d.role ?? "On duty"}:</span>
                <span className={d.user_id ? "" : "font-medium text-danger"}>{d.person?.name ?? "Nobody yet"}</span>
                {d.swap_requested && <StatusBadge tone="warning">Swap asked</StatusBadge>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
