import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { getChurchAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, likePattern, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PriorityBadge, TicketStatusBadge } from "./SupportBadges";
import { NAV_ICONS } from "@/components/ui/NavIcon";

const TABS = [
  { key: "active", label: "Open & in progress" },
  { key: "priority", label: "Priority" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
] as const;

export default async function SupportPage({ searchParams }: { searchParams: { status?: string; q?: string; page?: string } }) {
  const gate = await moduleGate("support");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const platform = me.role === "super_admin";
  const tab = TABS.some((t) => t.key === searchParams.status) ? searchParams.status! : "active";
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const page = pageFrom(searchParams.page);

  let query = createClient()
    .from("support_tickets")
    .select("id, subject, status, priority, created_at, updated_at, churches(name), creator:app_users!support_tickets_created_by_fkey(name)")
    .order("updated_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  // Super admins see every church; church admins their church; others their own.
  if (!platform && can(me.role, "manageSupportTickets")) query = query.eq("church_id", me.church_id);
  else if (!platform) query = query.eq("created_by", me.id);
  if (tab === "active") query = query.neq("status", "closed");
  if (tab === "priority") query = query.neq("status", "closed").eq("priority", "high");
  if (tab === "closed") query = query.eq("status", "closed");
  if (q) query = query.ilike("subject", likePattern(q));
  const { data, error } = await query;
  if (error) console.error("[support] list failed:", error.message);

  // High-priority tickets (Unlimited churches) first on the page.
  const tickets: any[] = (data ?? []).slice(0, PAGE_SIZE).sort((a: any, b: any) => Number(b.priority === "high") - Number(a.priority === "high"));
  const access = platform ? null : await getChurchAccess();
  const prioritySupport = Boolean(access?.modules.has("priority_support"));
  const whatsapp = (process.env.SUPPORT_WHATSAPP_NUMBER ?? "").replace(/[^\d]/g, "");
  const newButton = platform ? null : (
    <Link href="/dashboard/support/new" className="btn-primary">
      New ticket
    </Link>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title={platform ? "Support tickets" : "Support"}
        description={platform ? "Tickets from every church on the platform." : "Something not working, or a question about the app? Open a ticket and the platform team will help."}
        actions={newButton}
      />

      {prioritySupport && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success-line bg-success-tint p-4">
          <div>
            <p className="font-semibold">Priority support</p>
            <p className="text-sm text-ink/70">Your plan includes priority support: your tickets go to the front of the queue and are answered the same working day.</p>
          </div>
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hi, this is ${me.name} (Grace church app).`)}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
              WhatsApp support
            </a>
          )}
        </div>
      )}

      <nav aria-label="Ticket status" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.filter((t) => t.key !== "priority" || platform).map((t) => (
          <Link
            key={t.key}
            href={buildQuery({ status: t.key === "active" ? undefined : t.key, q })}
            aria-current={tab === t.key ? "page" : undefined}
            className={`px-3 py-2 text-sm -mb-px border-b-2 whitespace-nowrap ${tab === t.key ? "border-ember font-semibold" : "border-transparent text-ink/60 hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <FilterBar query={q} placeholder="Search by subject…" label="Search tickets" resetHref={buildQuery({ status: tab === "active" ? undefined : tab })} active={Boolean(q)}>
        {tab !== "active" && <input type="hidden" name="status" value={tab} />}
      </FilterBar>

      {error ? (
        <Alert tone="error">Couldn&apos;t load tickets — refresh the page to try again.</Alert>
      ) : !tickets.length ? (
        <EmptyState
          icon={NAV_ICONS.support}
          title={q ? "No tickets match that search" : tab === "closed" ? "No closed tickets" : "No open tickets"}
          description={platform || q ? undefined : "If something in the app isn't working, open a ticket and we'll help."}
          action={q ? undefined : newButton}
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/support/${t.id}`} className="card-interactive rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-ink/60">
                    {platform && t.churches?.name ? `${t.churches.name} · ` : ""}
                    {t.creator?.name ? `${t.creator.name} · ` : ""}
                    Updated {formatDate(t.updated_at, { weekday: undefined })}
                  </p>
                </div>
                <span className="flex flex-wrap gap-2">
                  <PriorityBadge priority={t.priority} />
                  <TicketStatusBadge status={t.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} hasMore={(data?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ status: tab === "active" ? undefined : tab, q, page: p })} />
    </div>
  );
}
