import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getChurchAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { MODULE_LABELS, PLAN_LABELS, MODULE_KEYS } from "@/lib/subscription";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PermissionDenied } from "@/components/ui/Gates";
import { Check, Circle } from "lucide-react";

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
  // Before migration #30 this table doesn't exist: the step just shows "To do".
  const { data: givingDetails } = await supabase.from("church_giving_details").select("bank_name, account_number").eq("church_id", me.church_id).maybeSingle();

  const steps = [
    { title: "Church profile", description: "Name, contact details and logo", done: Boolean(church?.address || church?.phone), href: "/dashboard/setup/profile" },
    { title: "Create departments", description: `${departments ?? 0} created — e.g. Worship, Youth, Ushers`, done: (departments ?? 0) > 0, href: "/dashboard/departments" },
    { title: "Invite your members", description: `${members ?? 0} people so far`, done: (members ?? 0) > 1, href: "/dashboard/members/new" },
    ...(access?.modules.has("giving")
      ? [
          {
            title: "Bank details for giving",
            description: givingDetails ? `${givingDetails.bank_name} · account ending ${givingDetails.account_number.slice(-4)}` : "Where members send tithes and offerings",
            done: Boolean(givingDetails),
            href: "/dashboard/setup/giving",
          },
        ]
      : []),
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
            <Link href={s.href} className="card-interactive rounded-xl p-4 flex items-center justify-between gap-3">
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
                {on ? (
                  <Check aria-hidden className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Circle aria-hidden className="h-4 w-4 shrink-0 text-ink/30" />
                )}
                <span className={on ? "" : "text-ink/60"}>{MODULE_LABELS[k]}</span>
                <span className="sr-only">{on ? "(included)" : "(not on your plan)"}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
