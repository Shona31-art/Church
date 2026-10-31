import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { formatDate, formatDateTime } from "@/lib/format";
import { PAGE_SIZE, buildQuery, orFilterPattern, pageFrom } from "@/lib/list";
import { AUDIT_CATEGORIES, describeAction, describeChangedFields } from "@/lib/audit-labels";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { NAV_ICONS } from "@/components/ui/NavIcon";

export const metadata = { title: "Audit log" };

const KINDS: Record<string, { label: string; pattern: string }> = {
  signins: { label: "Sign-ins & sign-outs", pattern: "auth.%" },
  created: { label: "Added", pattern: "%.created" },
  updated: { label: "Edited", pattern: "%.updated" },
  deleted: { label: "Deleted", pattern: "%.deleted" },
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Dates are picked in South African time.
const startOfDay = (d: string) => new Date(`${d}T00:00:00+02:00`).toISOString();
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999+02:00`).toISOString();

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { q?: string; church?: string; type?: string; kind?: string; from?: string; to?: string; page?: string };
}) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;

  const supabase = createClient();
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const church = /^[0-9a-f-]{36}$/i.test(searchParams.church ?? "") ? searchParams.church : undefined;
  const type = searchParams.type && AUDIT_CATEGORIES[searchParams.type] ? searchParams.type : undefined;
  const kind = searchParams.kind && KINDS[searchParams.kind] ? searchParams.kind : undefined;
  const from = DAY.test(searchParams.from ?? "") ? searchParams.from : undefined;
  const to = DAY.test(searchParams.to ?? "") ? searchParams.to : undefined;
  const page = pageFrom(searchParams.page);

  const { data: churches } = await supabase.from("churches").select("id, name").order("name").limit(2000);

  // Person search: match names or emails, then filter the log by those people.
  let actorIds: string[] | null = null;
  if (q) {
    const { data: people } = await supabase
      .from("app_users")
      .select("id")
      .or(`name.ilike.${orFilterPattern(q)},email.ilike.${orFilterPattern(q)}`)
      .limit(500);
    actorIds = (people ?? []).map((p) => p.id);
  }

  let rows: any[] = [];
  let total = 0;
  let error: string | null = null;
  if (!actorIds || actorIds.length) {
    let query = supabase
      .from("audit_logs")
      .select("id, action, created_at, target_table, metadata, church:churches(id, name), actor:app_users!audit_logs_actor_id_fkey(id, name, email, role)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (church) query = query.eq("church_id", church);
    if (type) query = query.like("action", `${type}.%`);
    if (kind) query = query.like("action", KINDS[kind].pattern);
    if (from) query = query.gte("created_at", startOfDay(from));
    if (to) query = query.lte("created_at", endOfDay(to));
    if (actorIds) query = query.in("actor_id", actorIds);
    const res = await query;
    if (res.error) {
      console.error("[audit-log]", res.error.message);
      error = res.error.message;
    }
    rows = res.data ?? [];
    total = res.count ?? 0;
  }

  const filters = { q, church, type, kind, from, to };
  const active = Boolean(q || church || type || kind || from || to);

  // Group by day for easier reading.
  const days: { day: string; items: any[] }[] = [];
  for (const r of rows) {
    const day = formatDate(r.created_at);
    if (days[days.length - 1]?.day !== day) days.push({ day, items: [] });
    days[days.length - 1].items.push(r);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        back={{ href: "/dashboard/super-admin", label: "Platform admin" }}
        title="Audit log"
        description="Every sign-in and every change people make, across all churches. Edits show which fields changed, never the private content."
      />

      <FilterBar query={q} placeholder="Search by person's name or email…" label="Search people" resetHref="/dashboard/super-admin/activity" active={active}>
        <FilterSelect name="church" label="Church" value={church} allLabel="All churches" options={(churches ?? []).map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect
          name="type"
          label="Area"
          value={type}
          allLabel="All areas"
          options={Object.entries(AUDIT_CATEGORIES)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect name="kind" label="Kind of activity" value={kind} allLabel="All activity" options={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))} />
        <div className="flex items-center gap-1">
          <label htmlFor="f-from" className="text-xs text-ink/60">
            From
          </label>
          <input id="f-from" name="from" type="date" defaultValue={from} className="input w-auto" />
        </div>
        <div className="flex items-center gap-1">
          <label htmlFor="f-to" className="text-xs text-ink/60">
            To
          </label>
          <input id="f-to" name="to" type="date" defaultValue={to} className="input w-auto" />
        </div>
      </FilterBar>

      {error ? (
        <Alert tone="error">Couldn&apos;t load the audit log — refresh to try again.</Alert>
      ) : !rows.length ? (
        <EmptyState icon={NAV_ICONS.activity} title={active ? "Nothing matches these filters" : "No activity recorded yet"} description={active ? "Try a wider date range or clear the filters." : "Sign-ins and changes will appear here as people use the app."} />
      ) : (
        <div className="space-y-5">
          {days.map(({ day, items }) => (
            <section key={day} className="card p-0">
              <h2 className="border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/60">{day}</h2>
              <ul className="divide-y divide-line">
                {items.map((a) => {
                  const changed = a.action.endsWith(".updated") ? describeChangedFields(a.metadata?.changed) : null;
                  const label = typeof a.metadata?.label === "string" ? a.metadata.label : null;
                  const device = typeof a.metadata?.device === "string" ? a.metadata.device : null;
                  return (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p>
                          <span className="font-medium">{a.actor?.name ?? (a.metadata?.email as string) ?? "System"}</span>{" "}
                          <span className="text-ink/80">{describeAction(a.action).replace(/^./, (c) => c.toLowerCase())}</span>
                          {label ? <span className="text-ink/80"> “{label}”</span> : null}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/60">
                          {a.church ? (
                            <Link href={`/dashboard/super-admin/churches/${a.church.id}`} className="hover:underline">
                              {a.church.name}
                            </Link>
                          ) : (
                            "Platform"
                          )}
                          {changed ? <> · changed {changed}</> : null}
                          {device ? <> · {device}</> : null}
                        </p>
                      </div>
                      <time dateTime={a.created_at} className="shrink-0 text-xs text-ink/60">
                        {formatDateTime(a.created_at, { weekday: undefined, day: undefined, month: undefined, year: undefined })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        hasMore={(page + 1) * PAGE_SIZE < total}
        hrefFor={(p) => `/dashboard/super-admin/activity${buildQuery({ ...filters, page: p })}`}
        summary={total ? `${total.toLocaleString("en-ZA")} ${total === 1 ? "entry" : "entries"}` : undefined}
      />
    </div>
  );
}
