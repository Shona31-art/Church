import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { GIVING_FUNDS, fundLabel } from "@/lib/giving";
import { formatDate, formatMoney, todayInAppZone } from "@/lib/format";
import { PAGE_SIZE, buildQuery, pageFrom } from "@/lib/list";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { WaitingGifts, type WaitingGift } from "./WaitingGifts";

export default async function GivingReportPage({ searchParams }: { searchParams: { year?: string; fund?: string; page?: string } }) {
  const gate = await moduleGate("giving");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "viewGivingReport")) {
    return <PermissionDenied message="Only church admins can view the giving report." backHref="/dashboard/giving" />;
  }

  const thisYear = Number(todayInAppZone().slice(0, 4));
  const year = /^\d{4}$/.test(searchParams.year ?? "") && Number(searchParams.year) <= thisYear ? Number(searchParams.year) : thisYear;
  const fund = (GIVING_FUNDS as readonly string[]).includes(searchParams.fund ?? "") ? searchParams.fund : undefined;
  const page = pageFrom(searchParams.page);
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year + 1}-01-01T00:00:00Z`;

  const supabase = createClient();
  let totalsQuery = supabase.from("givings").select("fund, amount_cents").eq("church_id", me.church_id).eq("status", "succeeded").gte("created_at", from).lt("created_at", to).limit(20000);
  let listQuery = supabase
    .from("givings")
    .select("id, amount_cents, fund, created_at, method, reference, paid_on, app_users!givings_user_id_fkey(name)")
    .eq("church_id", me.church_id)
    .eq("status", "succeeded")
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (fund) {
    totalsQuery = totalsQuery.eq("fund", fund);
    listQuery = listQuery.eq("fund", fund);
  }
  // Bank transfers members say they made, oldest first (not limited to the
  // year filter: anything still waiting needs attention).
  const waitingQuery = supabase
    .from("givings")
    .select("id, amount_cents, fund, paid_on, reference, updated_at, app_users!givings_user_id_fkey(name)")
    .eq("church_id", me.church_id)
    .eq("status", "reported")
    .order("paid_on", { ascending: true })
    .limit(51);
  const [{ data: totals, error }, { data: rows }, { data: waitingRows, error: waitingError }] = await Promise.all([totalsQuery, listQuery, waitingQuery]);
  // Before migration #30 there's no "reported" status yet; that's not an error worth showing.
  if (waitingError && !/status|column/i.test(waitingError.message)) console.error("[giving] waiting list failed:", waitingError.message);
  const waiting: WaitingGift[] = (waitingRows ?? []).slice(0, 50).map((g: any) => ({
    id: g.id,
    donor: g.app_users?.name ?? "Former member",
    reference: g.reference ?? "—",
    amountLabel: formatMoney(g.amount_cents),
    amountRand: (g.amount_cents / 100).toFixed(2),
    fund: fundLabel(g.fund),
    paidOn: g.paid_on ? formatDate(g.paid_on, { weekday: undefined }) : "—",
    updatedAt: g.updated_at,
  }));
  if (error) console.error("[giving] report failed:", error.message);

  const byFund = new Map<string, number>();
  let total = 0;
  for (const g of totals ?? []) {
    byFund.set(g.fund, (byFund.get(g.fund) ?? 0) + g.amount_cents);
    total += g.amount_cents;
  }
  const list: any[] = (rows ?? []).slice(0, PAGE_SIZE);
  const years = Array.from({ length: 5 }, (_, i) => String(thisYear - i));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/giving", label: "Giving" }}
        title="Giving report"
        description="Gifts your church has received — confirmed bank transfers and completed card payments. Donor names are visible to church admins only."
        actions={
          // Plain link: a CSV download from an API route.
          <a href={`/api/giving/export${buildQuery({ year, fund })}`} className="btn-secondary">
            Download CSV
          </a>
        }
      />

      <form className="flex flex-wrap items-center gap-2" role="search">
        <FilterSelect name="year" label="Year" value={String(year)} allLabel={String(thisYear)} options={years.slice(1).map((y) => ({ value: y, label: y }))} />
        <FilterSelect name="fund" label="Fund" value={fund} allLabel="All funds" options={GIVING_FUNDS.map((f) => ({ value: f, label: fundLabel(f) }))} />
        <button type="submit" className="btn-secondary">
          Apply
        </button>
      </form>

      {waiting.length > 0 && (
        <Section
          title={`Waiting for confirmation (${(waitingRows?.length ?? 0) > 50 ? "50+" : waiting.length})`}
          description="Bank transfers members say they made. Check each reference on your bank statement, then mark it received or not received."
        >
          <WaitingGifts gifts={waiting} />
          {(waitingRows?.length ?? 0) > 50 && <p className="mt-3 text-xs text-ink/60">Showing the 50 oldest. More appear as you work through these.</p>}
        </Section>
      )}

      {error ? (
        <Alert tone="error" title="Couldn't load the report">Refresh the page to try again.</Alert>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="card-elevated rounded-2xl p-4 col-span-2 lg:col-span-1">
              <p className="text-xs text-ink/60">Total {year}</p>
              <p className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</p>
            </div>
            {[...byFund.entries()].map(([f, cents]) => (
              <div key={f} className="card-elevated rounded-2xl p-4">
                <p className="text-xs text-ink/60">{fundLabel(f)}</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(cents)}</p>
              </div>
            ))}
          </div>

          <Section title="Transactions">
            {!list.length ? (
              <EmptyState title={`No gifts received in ${year}`} description="Bank transfers appear here once you mark them received; card gifts appear automatically." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Gifts received in {year}</caption>
                    <thead className="text-left text-xs uppercase tracking-wide text-ink/60">
                      <tr>
                        <th scope="col" className="py-2 pr-4">Date</th>
                        <th scope="col" className="py-2 pr-4">Donor</th>
                        <th scope="col" className="py-2 pr-4">Fund</th>
                        <th scope="col" className="py-2 pr-4">Method</th>
                        <th scope="col" className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {list.map((g) => (
                        <tr key={g.id}>
                          <td className="py-2 pr-4 whitespace-nowrap">{formatDate(g.method === "eft" && g.paid_on ? g.paid_on : g.created_at, { weekday: undefined })}</td>
                          <td className="py-2 pr-4">{g.app_users?.name ?? <span className="text-ink/60">Former member</span>}</td>
                          <td className="py-2 pr-4">{fundLabel(g.fund)}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {g.method === "eft" ? (
                              <>
                                Transfer <span className="tabular text-xs text-ink/60">{g.reference}</span>
                              </>
                            ) : (
                              "Card"
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatMoney(g.amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} hasMore={(rows?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ year, fund, page: p })} />
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
