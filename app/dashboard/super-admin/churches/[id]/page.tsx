import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { resolveAccountStatus, MODULE_KEYS, MODULE_LABELS, PLAN_LABELS } from "@/lib/subscription";
import { roleLabel } from "@/lib/permissions";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { SubscriptionBadge } from "../../SubscriptionBadge";
import { ModuleOverrideControl, SubscriptionForm } from "../../SuperAdminForms";
import { MemberStatusBadge } from "@/app/dashboard/members/MemberBadges";

export default async function ChurchDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: church }, { data: sub }, { data: overrides }, { data: people }, { data: activity }] = await Promise.all([
    supabase.from("churches").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("church_subscriptions").select("*").eq("church_id", params.id).maybeSingle(),
    supabase.from("church_modules").select("module_key, enabled").eq("church_id", params.id),
    supabase.from("app_users").select("id, name, email, role, status").eq("church_id", params.id).order("role").order("name").limit(500),
    supabase.from("audit_logs").select("id, action, created_at, actor:app_users!audit_logs_actor_id_fkey(name)").eq("church_id", params.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!church) notFound();

  const { data: planModules } = await supabase.from("plan_modules").select("module_key").eq("plan_key", sub?.plan_key ?? "free_trial");
  const planSet = new Set((planModules ?? []).map((m) => m.module_key));
  const overrideMap = new Map((overrides ?? []).map((o) => [o.module_key, o.enabled]));
  const effective = sub ? resolveAccountStatus(sub) : "none";
  const admins = (people ?? []).filter((p) => p.role === "church_admin");

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/super-admin/churches", label: "Churches" }}
        title={church.name}
        meta={
          <>
            <SubscriptionBadge status={effective} />
            {sub && <span className="text-sm text-ink/60">{PLAN_LABELS[sub.plan_key] ?? sub.plan_key}</span>}
          </>
        }
        actions={
          <Link href={`/dashboard/super-admin/users/new?church=${church.id}`} className="btn-secondary">
            Add user to this church
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Church">
          <DetailList
            items={[
              { label: "Email", value: church.email },
              { label: "Phone", value: church.phone },
              { label: "Address", value: church.address },
              { label: "Joined", value: formatDate(church.created_at) },
              { label: "Church admins", value: admins.map((a) => a.name).join(", ") || "None — add one" },
              { label: "People", value: String(people?.length ?? 0) },
            ]}
          />
        </Section>

        <Section title="Subscription" description="Changes take effect for the church immediately.">
          <SubscriptionForm churchId={church.id} churchName={church.name} sub={sub} />
        </Section>
      </div>

      <Section title="Features" description="Each feature follows the plan unless you force it on or off for this church.">
        <ul className="divide-y divide-line">
          {MODULE_KEYS.map((key) => {
            const override = overrideMap.get(key);
            const mode = override === undefined ? "plan" : override ? "on" : "off";
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  {MODULE_LABELS[key]}
                  {mode !== "plan" && <span className="ml-2 text-xs text-warning">(override)</span>}
                </span>
                <ModuleOverrideControl churchId={church.id} moduleKey={key} moduleName={MODULE_LABELS[key]} mode={mode} planIncludes={planSet.has(key)} />
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="People" description="Login accounts in this church.">
        {!people?.length ? (
          <p className="text-sm text-ink/60">No one yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/dashboard/super-admin/users/${p.id}`} className="text-sm hover:underline">
                  <span className="font-medium">{p.name}</span> <span className="text-ink/60">· {p.email}</span>
                </Link>
                <span className="flex items-center gap-2 text-xs text-ink/60">
                  {roleLabel(p.role)} <MemberStatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent activity">
        {!activity?.length ? (
          <p className="text-sm text-ink/60">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {activity.map((a: any) => (
              <li key={a.id} className="py-2 flex flex-wrap justify-between gap-2">
                <span>
                  <code className="text-xs">{a.action}</code>
                  {a.actor?.name && <span className="text-ink/60"> · {a.actor.name}</span>}
                </span>
                <span className="text-xs text-ink/60">{formatRelative(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
