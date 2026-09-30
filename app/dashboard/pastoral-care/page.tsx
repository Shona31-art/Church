import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { LOG_TYPES, LOG_TYPE_LABELS, LogType } from "@/lib/pastoral-care";
import { setFollowUpDone, deleteCareLog } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";

const PAGE_SIZE = 25;

export default async function PastoralCarePage({
  searchParams,
}: {
  searchParams: { type?: string; q?: string; page?: string };
}) {
  const access = await checkModuleAccess("pastoral_care");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role)) {
    return <p className="text-ink/60">The pastoral care log is only available to pastors and church admins.</p>;
  }

  const supabase = createClient();
  const page = Math.max(0, Number(searchParams.page) || 0);
  const type = LOG_TYPES.includes(searchParams.type as LogType) ? (searchParams.type as LogType) : undefined;
  const q = (searchParams.q ?? "").trim().slice(0, 80);

  let query = supabase
    .from("pastoral_care_logs")
    .select("id, member_id, member_name, log_type, notes, location, follow_up_date, follow_up_done, created_at, author:app_users!pastoral_care_logs_created_by_fkey(name)")
    .eq("church_id", me.church_id)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (type) query = query.eq("log_type", type);
  // Escape LIKE wildcards so a search for "50%" means literally that.
  if (q) query = query.ilike("member_name", `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);

  const { data, error } = await query;
  const logs: any[] = (data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (data?.length ?? 0) > PAGE_SIZE;
  const today = new Date().toISOString().slice(0, 10);

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { type, q: q || undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-semibold">Pastoral care log</h1>
        <Link href="/dashboard/pastoral-care/new" className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Record care
        </Link>
      </div>
      <p className="text-xs text-ink/50 mb-6">
        🔒 Confidential. Visible only to pastors and church admins of your church — never to members or platform staff.
        Every change is audit-logged.
      </p>

      <form className="flex flex-wrap gap-2 mb-6" role="search">
        <label htmlFor="q" className="sr-only">Search by name</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name…" className="border border-ink/20 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <label htmlFor="type" className="sr-only">Type of care</label>
        <select id="type" name="type" defaultValue={type ?? ""} className="border border-ink/20 rounded-lg px-3 py-2 text-sm">
          <option value="">All types</option>
          {LOG_TYPES.map((t) => (
            <option key={t} value={t}>{LOG_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button type="submit" className="border border-ink/20 rounded-lg px-4 py-2 text-sm hover:bg-ink/5">Filter</button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          ⚠ Couldn&apos;t load care records. If this is a new setup, make sure <code>church_os_features_schema.sql</code> has been run.
        </p>
      )}

      {!error && logs.length === 0 && (
        <div className="card-elevated rounded-2xl p-6 text-center">
          <p className="text-ink/60">{q || type ? "No records match that filter." : "No care records yet."}</p>
          <p className="text-sm text-ink/40 mt-1">Record hospital visits, counselling sessions and follow-ups so nobody falls through the cracks.</p>
        </div>
      )}

      <div className="space-y-3">
        {logs.map((log) => {
          const overdue = log.follow_up_date && !log.follow_up_done && log.follow_up_date < today;
          return (
            <article key={log.id} className="card-elevated rounded-2xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {log.member_id ? (
                    <Link href={`/dashboard/members/${log.member_id}`} className="hover:underline">{log.member_name}</Link>
                  ) : (
                    log.member_name
                  )}
                  <span className="ml-2 text-xs font-normal text-ink/50">{LOG_TYPE_LABELS[log.log_type as LogType] ?? log.log_type}</span>
                </p>
                <p className="text-xs text-ink/50">
                  {new Date(log.created_at).toLocaleDateString()} · {log.author?.name ?? "—"}
                  {log.location ? ` · ${log.location}` : ""}
                </p>
              </div>
              <p className="text-sm mt-3 whitespace-pre-line">{log.notes}</p>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                {log.follow_up_date && (
                  <span className={`text-xs ${log.follow_up_done ? "text-green-800" : overdue ? "text-red-700 font-semibold" : "text-ink/60"}`}>
                    {log.follow_up_done ? "✓ Followed up" : overdue ? "⚠ Follow-up overdue" : "Follow up"}
                    {" · "}
                    {new Date(log.follow_up_date + "T00:00:00").toLocaleDateString()}
                  </span>
                )}
                {log.follow_up_date && (
                  <form action={setFollowUpDone}>
                    <input type="hidden" name="id" value={log.id} />
                    <input type="hidden" name="done" value={log.follow_up_done ? "false" : "true"} />
                    <PendingButton className="text-xs border border-ink/15 rounded-lg px-3 py-1.5 hover:bg-ink/5">
                      {log.follow_up_done ? "Reopen" : "Mark done"}
                    </PendingButton>
                  </form>
                )}
                <form action={deleteCareLog} className="ml-auto">
                  <input type="hidden" name="id" value={log.id} />
                  <ConfirmSubmitButton
                    message={`Permanently delete this care record for ${log.member_name}? This can't be undone.`}
                    className="text-xs text-red-700 rounded-lg px-3 py-1.5 hover:bg-red-50"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      {(page > 0 || hasMore) && (
        <nav className="flex justify-between mt-6 text-sm" aria-label="Pagination">
          {page > 0 ? <Link href={qs({ page: String(page - 1) })} className="text-ember">← Newer</Link> : <span />}
          {hasMore && <Link href={qs({ page: String(page + 1) })} className="text-ember">Older →</Link>}
        </nav>
      )}
    </div>
  );
}
