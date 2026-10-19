import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { LOG_TYPES, LOG_TYPE_LABELS, type LogType } from "@/lib/pastoral-care";
import { formatDate, todayInAppZone } from "@/lib/format";
import { PAGE_SIZE, buildQuery, likePattern, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PermissionDenied } from "@/components/ui/Gates";
import { DeleteCareLog, FollowUpToggle } from "./CareLogControls";
import { NAV_ICONS } from "@/components/ui/NavIcon";
import { PrivacyNote } from "@/components/ui/PrivacyNote";

export default async function PastoralCarePage({ searchParams }: { searchParams: { type?: string; q?: string; page?: string; due?: string } }) {
  const gate = await moduleGate("pastoral_care");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "pastoralCare")) {
    return <PermissionDenied message="The pastoral care log is confidential and only available to pastors and church admins." />;
  }

  const page = pageFrom(searchParams.page);
  const type = LOG_TYPES.includes(searchParams.type as LogType) ? (searchParams.type as LogType) : undefined;
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const due = searchParams.due === "1";
  const today = todayInAppZone();

  let query = createClient()
    .from("pastoral_care_logs")
    .select("id, member_id, member_name, log_type, notes, location, follow_up_date, follow_up_done, created_at, author:app_users!pastoral_care_logs_created_by_fkey(name)")
    .eq("church_id", me.church_id)
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (type) query = query.eq("log_type", type);
  if (q) query = query.ilike("member_name", likePattern(q));
  query = due
    ? query.eq("follow_up_done", false).not("follow_up_date", "is", null).order("follow_up_date")
    : query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) console.error("[pastoral-care] list failed:", error.message);
  const logs: any[] = (data ?? []).slice(0, PAGE_SIZE);
  const filtered = Boolean(q || type || due);
  const addButton = (
    <Link href="/dashboard/pastoral-care/new" className="btn-primary">
      Record care
    </Link>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Pastoral care"
        description={
          <PrivacyNote>
            Confidential. Visible only to your church&apos;s pastors and admins — never to members or platform staff. Every change is audit-logged.
          </PrivacyNote>
        }
        actions={addButton}
      />

      <FilterBar query={q} placeholder="Search by name…" label="Search care records" resetHref="/dashboard/pastoral-care" active={filtered}>
        <FilterSelect name="type" label="Type of care" value={type} allLabel="All types" options={LOG_TYPES.map((t) => ({ value: t, label: LOG_TYPE_LABELS[t] }))} />
        <FilterSelect name="due" label="Follow-ups" value={due ? "1" : ""} allLabel="All records" options={[{ value: "1", label: "Open follow-ups" }]} />
      </FilterBar>

      {error ? (
        <Alert tone="error" title="Couldn't load care records">Refresh the page to try again.</Alert>
      ) : logs.length === 0 ? (
        filtered ? (
          <EmptyState title="No records match those filters" action={<Link href="/dashboard/pastoral-care" className="btn-secondary">Clear filters</Link>} />
        ) : (
          <EmptyState icon={NAV_ICONS.pastoralCare} title="No care records yet" description="Record hospital visits, counselling sessions and follow-ups so nobody falls through the cracks." action={addButton} />
        )
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => {
            const overdue = log.follow_up_date && !log.follow_up_done && log.follow_up_date < today;
            return (
              <li key={log.id}>
                <article className="card-elevated rounded-2xl p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-semibold text-base">
                      {log.member_id ? (
                        <Link href={`/dashboard/members/${log.member_id}`} className="hover:underline">
                          {log.member_name}
                        </Link>
                      ) : (
                        log.member_name
                      )}
                    </h2>
                    <p className="text-xs text-ink/60">
                      {formatDate(log.created_at)} · {log.author?.name ?? "—"}
                      {log.location ? ` · ${log.location}` : ""}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge tone="neutral">{LOG_TYPE_LABELS[log.log_type as LogType] ?? log.log_type}</StatusBadge>
                    {log.follow_up_date &&
                      (log.follow_up_done ? (
                        <StatusBadge tone="success">Followed up</StatusBadge>
                      ) : overdue ? (
                        <StatusBadge tone="danger">Follow-up overdue · {formatDate(log.follow_up_date, { weekday: undefined })}</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Follow up by {formatDate(log.follow_up_date, { weekday: undefined })}</StatusBadge>
                      ))}
                  </div>
                  <p className="text-sm mt-3 whitespace-pre-line">{log.notes}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {log.follow_up_date && <FollowUpToggle id={log.id} done={log.follow_up_done} />}
                    <Link href={`/dashboard/pastoral-care/${log.id}/edit`} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                    <div className="ml-auto">
                      <DeleteCareLog id={log.id} memberName={log.member_name} />
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} hasMore={(data?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ q, type, due: due ? "1" : undefined, page: p })} />
    </div>
  );
}
