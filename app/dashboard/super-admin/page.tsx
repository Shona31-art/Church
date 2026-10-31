import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { describeAction } from "@/lib/audit-labels";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { resolveAccountStatus, PLAN_LABELS } from "@/lib/subscription";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PermissionDenied } from "@/components/ui/Gates";

export default async function SuperAdminHome() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;

  const supabase = createClient();
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const [{ count: totalChurches }, { count: totalUsers }, { data: subs }, { count: openTickets }, { data: recent }, { data: activity }] = await Promise.all([
    supabase.from("churches").select("id", { count: "exact", head: true }),
    supabase.from("app_users").select("id", { count: "exact", head: true }).neq("role", "super_admin"),
    supabase.from("church_subscriptions").select("church_id, plan_key, status, is_lifetime, trial_expires_at, grace_period_end, churches(name)").limit(10000),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
    supabase.from("churches").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("audit_logs").select("id, action, created_at, churches(name), actor:app_users!audit_logs_actor_id_fkey(name)").order("created_at", { ascending: false }).limit(10),
  ]);

  const effective = (subs ?? []).map((s: any) => ({ ...s, effective: resolveAccountStatus(s) }));
  const count = (status: string) => effective.filter((s) => s.effective === status).length;
  const trialsEnding = effective.filter((s) => s.effective === "trial" && s.trial_expires_at && s.trial_expires_at <= weekAhead);
  const inGrace = effective.filter((s) => s.effective === "grace");

  const stats = [
    { label: "Churches", value: totalChurches ?? 0, href: "/dashboard/super-admin/churches" },
    { label: "Active (paying or sponsored)", value: count("active"), href: "/dashboard/super-admin/churches?status=active" },
    { label: "On free trial", value: count("trial"), href: "/dashboard/super-admin/churches?status=trial" },
    { label: "Suspended", value: count("suspended"), href: "/dashboard/super-admin/churches?status=suspended" },
    { label: "Church users", value: totalUsers ?? 0, href: "/dashboard/super-admin/users" },
    { label: "Open support tickets", value: openTickets ?? 0, href: "/dashboard/support" },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Platform overview"
        description="Every church on the platform. Church content (prayers, care notes, journals) is never visible here."
        actions={
          <>
            <Link href="/dashboard/super-admin/plans" className="btn-secondary">
              Plans &amp; prices
            </Link>
            <Link href="/dashboard/super-admin/users/new" className="btn-secondary">
              Add user
            </Link>
            <Link href="/dashboard/super-admin/churches/new" className="btn-primary">
              Add church
            </Link>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card-interactive rounded-xl p-4">
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-ink/60 mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Needs attention">
          {!trialsEnding.length && !inGrace.length ? (
            <p className="text-sm text-ink/60">No trials ending this week and no churches with failed payments.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {inGrace.map((s) => (
                <li key={s.church_id} className="py-2 flex items-center justify-between gap-2">
                  <Link href={`/dashboard/super-admin/churches/${s.church_id}`} className="hover:underline">
                    {s.churches?.name}
                  </Link>
                  <StatusBadge tone="warning">Payment failed · until {formatDate(s.grace_period_end, { weekday: undefined })}</StatusBadge>
                </li>
              ))}
              {trialsEnding.map((s) => (
                <li key={s.church_id} className="py-2 flex items-center justify-between gap-2">
                  <Link href={`/dashboard/super-admin/churches/${s.church_id}`} className="hover:underline">
                    {s.churches?.name}
                  </Link>
                  <StatusBadge tone="info">Trial ends {formatDate(s.trial_expires_at, { weekday: undefined })}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Newest churches">
          <ul className="divide-y divide-line text-sm">
            {(recent ?? []).map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                <Link href={`/dashboard/super-admin/churches/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-ink/60">{formatRelative(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-display text-xl">Recent platform activity</span>
            <span className="text-sm text-ink/60">The latest sign-ins and changes across all churches.</span>
          </span>
          <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-ink/50 transition-transform group-open:rotate-180" />
        </summary>
        {!activity?.length ? (
          <p className="mt-4 text-sm text-ink/60">No activity recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-sm">
            {activity.map((a: any) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {a.actor?.name ? <span className="font-medium">{a.actor.name} </span> : null}
                  <span>{describeAction(a.action).replace(/^./, (c) => (a.actor?.name ? c.toLowerCase() : c))}</span>
                  {a.churches?.name ? <span className="text-ink/60"> · {a.churches.name}</span> : null}
                </span>
                <span className="text-xs text-ink/60">{formatRelative(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/dashboard/super-admin/activity" className="btn-secondary mt-4">
          Open full audit log
        </Link>
      </details>

      <p className="text-xs text-ink/60">Plans: {Object.values(PLAN_LABELS).join(" · ")}</p>
    </div>
  );
}
