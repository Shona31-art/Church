import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getChurchAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { MODULE_LABELS, PLAN_LABELS, MODULE_KEYS } from "@/lib/subscription";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PermissionDenied } from "@/components/ui/Gates";

export default async function ChurchSettingsPage() {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageChurchProfile")) {
    return <PermissionDenied message="Only church admins can open church settings." />;
  }

  const supabase = createClient();
  const [access, { data: church }, { count: departments }, { count: members }, { data: counseling }] = await Promise.all([
    getChurchAccess(),
    supabase.from("churches").select("name, address, phone, email").eq("id", me.church_id).maybeSingle(),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("church_id", me.church_id),
    supabase.from("app_users").select("id", { count: "exact", head: true }).eq("church_id", me.church_id),
    supabase.from("counseling_settings").select("enabled").eq("church_id", me.church_id).maybeSingle(),
  ]);

  const steps = [
    { title: "Church profile", description: "Name, contact details and logo", done: Boolean(church?.address || church?.phone), href: "/dashboard/setup/profile" },
    { title: "Create departments", description: `${departments ?? 0} created — e.g. Worship, Youth, Ushers`, done: (departments ?? 0) > 0, href: "/dashboard/departments" },
    { title: "Invite your members", description: `${members ?? 0} people so far`, done: (members ?? 0) > 1, href: "/dashboard/members/new" },
    ...(access?.modules.has("ai_counseling")
      ? [{ title: "Decide on AI counseling", description: counseling?.enabled ? "Turned on" : "Off until you turn it on", done: counseling !== null, href: "/dashboard/counseling/settings" }]
      : []),
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Church settings"
        description={remaining ? `${remaining} step${remaining === 1 ? "" : "s"} left to get your church ready. You can change any of these later.` : "Your church is set up. Change anything here at any time."}
      />

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link href={s.href} className="card-elevated rounded-xl p-4 flex items-center justify-between gap-3 hover:border-gold/60">
              <div>
                <p className="font-medium">
                  {i + 1}. {s.title}
                </p>
                <p className="text-xs text-ink/60">{s.description}</p>
              </div>
              {s.done ? <StatusBadge tone="success">Done</StatusBadge> : <StatusBadge tone="warning">To do</StatusBadge>}
            </Link>
          </li>
        ))}
      </ol>

      <Section
        title="Features on your plan"
        description={access?.planKey ? `You're on the ${PLAN_LABELS[access.planKey] ?? access.planKey} plan.` : undefined}
        actions={
          <Link href="/dashboard/billing" className="btn-secondary btn-sm">
            Billing & plans
          </Link>
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          {MODULE_KEYS.filter((k) => !["analytics", "multi_campus"].includes(k)).map((k) => {
            const on = access?.modules.has(k);
            return (
              <li key={k} className="flex items-center gap-2">
                <span aria-hidden className={on ? "text-success" : "text-ink/30"}>
                  {on ? "✓" : "○"}
                </span>
                <span className={on ? "" : "text-ink/50"}>{MODULE_LABELS[k]}</span>
                <span className="sr-only">{on ? "(included)" : "(not on your plan)"}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
