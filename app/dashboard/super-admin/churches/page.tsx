import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { resolveAccountStatus, PLAN_LABELS } from "@/lib/subscription";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, likePattern, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { SubscriptionBadge } from "../SubscriptionBadge";

const STATUSES = ["active", "trial", "grace", "payment_pending", "suspended"];

export default async function AllChurchesPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string } }) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;

  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const status = STATUSES.includes(searchParams.status ?? "") ? searchParams.status : undefined;
  const page = pageFrom(searchParams.page);

  // Status filtering uses the *effective* status (expired trials count as
  // suspended), which isn't a column, so it's applied after the name search.
  // Fine at platform scale (hundreds of churches); revisit beyond ~10k.
  let query = createClient()
    .from("churches")
    .select("id, name, email, created_at, church_subscriptions(plan_key, status, is_lifetime, trial_expires_at, grace_period_end), app_users(count)")
    .order("name")
    .limit(2000);
  if (q) query = query.ilike("name", likePattern(q));
  const { data, error } = await query;
  if (error) console.error("[super-admin] churches failed:", error.message);

  const rows = (data ?? [])
    .map((c: any) => {
      const sub = Array.isArray(c.church_subscriptions) ? c.church_subscriptions[0] : c.church_subscriptions;
      return { ...c, sub, effective: sub ? resolveAccountStatus(sub) : "none", members: c.app_users?.[0]?.count ?? 0 };
    })
    .filter((c) => !status || c.effective === status);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const addButton = (
    <Link href="/dashboard/super-admin/churches/new" className="btn-primary">
      Add church
    </Link>
  );

  return (
    <div className="max-w-6xl">
      <PageHeader title="Churches" description={`${rows.length} ${rows.length === 1 ? "church" : "churches"}${status || q ? " match your filters" : " on the platform"}.`} actions={addButton} />

      <FilterBar query={q} placeholder="Search by church name…" label="Search churches" resetHref="/dashboard/super-admin/churches" active={Boolean(q || status)}>
        <FilterSelect name="status" label="Status" value={status} allLabel="All statuses" options={STATUSES.map((s) => ({ value: s, label: s.replace("_", " ").replace(/^./, (c) => c.toUpperCase()) }))} />
      </FilterBar>

      {error ? (
        <Alert tone="error">Couldn&apos;t load churches — refresh to try again.</Alert>
      ) : !pageRows.length ? (
        <EmptyState title={q || status ? "No churches match" : "No churches yet"} action={q || status ? undefined : addButton} />
      ) : (
        <>
          <div className="hidden md:block card-elevated rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Churches</caption>
              <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th scope="col" className="px-4 py-3">Church</th>
                  <th scope="col" className="px-4 py-3">Plan</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Members</th>
                  <th scope="col" className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((c) => (
                  <tr key={c.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/super-admin/churches/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-ink/60">{c.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {c.sub ? PLAN_LABELS[c.sub.plan_key] ?? c.sub.plan_key : "—"}
                      {c.sub?.is_lifetime ? " · lifetime" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionBadge status={c.effective} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.members}</td>
                    <td className="px-4 py-3 text-ink/60">{formatDate(c.created_at, { weekday: undefined })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-2">
            {pageRows.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/super-admin/churches/${c.id}`} className="card-elevated rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-ink/60">
                      {c.sub ? PLAN_LABELS[c.sub.plan_key] : "No plan"} · {c.members} members
                    </p>
                  </div>
                  <SubscriptionBadge status={c.effective} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} hasMore={(page + 1) * PAGE_SIZE < rows.length} hrefFor={(p) => buildQuery({ q, status, page: p })} />
        </>
      )}
    </div>
  );
}
