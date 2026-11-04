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
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/format";
import { invoiceNumber } from "@/lib/billing-emails";
import { isOverdue } from "@/lib/platform";
import { DeleteChurchForm, EmailLeadersForm, RecordPaymentForm } from "../../ChurchAccountForms";
import { extendTrial, restoreChurch, sendReminderNow, suspendChurch } from "../../church-actions";

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
  const [{ data: payments }, { data: plans }] = await Promise.all([
    supabase.from("billing_payments").select("*").eq("church_id", params.id).eq("status", "succeeded").order("paid_at", { ascending: false }).limit(12),
    supabase.from("plans").select("key, monthly_price, yearly_price").in("key", ["basic", "premium", "enterprise"]),
  ]);
  const prices = Object.fromEntries((plans ?? []).map((p) => [p.key, { monthly: Number(p.monthly_price), yearly: p.yearly_price == null ? null : Number(p.yearly_price) }]));
  if (!church) notFound();

  const { data: planModules } = await supabase.from("plan_modules").select("module_key").eq("plan_key", sub?.plan_key ?? "free_trial");
  const planSet = new Set((planModules ?? []).map((m) => m.module_key));
  const overrideMap = new Map((overrides ?? []).map((o) => [o.module_key, o.enabled]));
  const effective = sub ? resolveAccountStatus(sub) : "none";
  const overdue = sub ? isOverdue(sub) : false;
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

      <Section title="Account" description="Pause a church that hasn't paid (nothing is deleted), switch it back on, extend a trial, or record a payment made by EFT or cash.">
        {/* At a glance */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="col-span-2 rounded-xl bg-ink/[0.04] p-3 sm:col-span-1">
            <p className="text-xs text-ink/60">Status</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5">
              <SubscriptionBadge status={effective} />
              {overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
            </p>
          </div>
          <div className="rounded-xl bg-ink/[0.04] p-3">
            <p className="text-xs text-ink/60">Plan</p>
            <p className="mt-1 font-semibold">
              {sub ? PLAN_LABELS[sub.plan_key] ?? sub.plan_key : "None"}
              {sub?.is_lifetime ? " · lifetime" : sub?.billing_interval === "yearly" ? " · yearly" : ""}
            </p>
          </div>
          <div className="rounded-xl bg-ink/[0.04] p-3">
            <p className="text-xs text-ink/60">{sub?.plan_key === "free_trial" ? "Trial ends" : overdue ? "Was due" : "Paid until"}</p>
            <p className="mt-1 font-semibold">
              {sub?.plan_key === "free_trial"
                ? sub.trial_expires_at
                  ? formatDate(sub.trial_expires_at, { weekday: undefined })
                  : "—"
                : sub?.billing_date
                ? formatDate(sub.billing_date, { weekday: undefined })
                : "—"}
            </p>
          </div>
        </div>
        {(sub?.paystack_subscription_code || sub?.suspended_at) && (
          <p className="mt-2 text-xs text-ink/60">
            {sub?.paystack_subscription_code ? "Pays by card through Paystack. " : ""}
            {sub?.suspended_at ? `Suspended on ${formatDate(sub.suspended_at, { weekday: undefined })}.` : ""}
          </p>
        )}

        {/* Actions */}
        <div className="mt-5 space-y-3">
          <RecordPaymentForm churchId={church.id} currentPlan={sub?.plan_key ?? "basic"} prices={prices} />
          <div className="grid gap-2 sm:grid-cols-2">
            <form action={sendReminderNow}>
              <input type="hidden" name="church_id" value={church.id} />
              <PendingButton className="btn-secondary w-full justify-center" pendingLabel="Sending…">
                Send payment reminder
              </PendingButton>
            </form>
            <EmailLeadersForm churchId={church.id} churchName={church.name} />
          </div>
          {(sub?.plan_key ?? "free_trial") === "free_trial" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
              <span className="mr-1 w-full text-sm font-medium sm:w-auto">Extend the trial</span>
              {[7, 14, 30].map((d) => (
                <form key={d} action={extendTrial}>
                  <input type="hidden" name="church_id" value={church.id} />
                  <input type="hidden" name="days" value={d} />
                  <PendingButton className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold hover:border-ember" pendingLabel="…">
                    +{d} days
                  </PendingButton>
                </form>
              ))}
            </div>
          )}
          {effective === "suspended" ? (
            <form action={restoreChurch}>
              <input type="hidden" name="church_id" value={church.id} />
              <PendingButton className="btn-primary w-full justify-center" pendingLabel="Restoring…">
                Switch back on
              </PendingButton>
            </form>
          ) : (
            <details className="rounded-xl border border-danger-line">
              <summary className="cursor-pointer list-none px-4 py-3 text-center text-sm font-semibold text-danger">Suspend for not paying…</summary>
              <form action={suspendChurch} className="space-y-3 border-t border-danger-line p-3">
                <input type="hidden" name="church_id" value={church.id} />
                <label className="block text-sm font-medium" htmlFor="suspend-reason">
                  Reason
                </label>
                <input id="suspend-reason" name="reason" maxLength={300} className="input" defaultValue="Payment not received" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" /> Tell their leaders (app + email)
                </label>
                <ConfirmSubmitButton
                  className="btn-danger w-full justify-center"
                  title={`Suspend ${church.name}?`}
                  message="Members can still sign in, but features are paused until you switch them back on. No data is deleted."
                  confirmLabel="Suspend"
                  pendingLabel="Suspending…"
                >
                  Suspend now
                </ConfirmSubmitButton>
              </form>
            </details>
          )}
        </div>
        {sub?.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-ink/5 p-3 text-xs text-ink/70">{sub.notes}</p>}
      </Section>

      {(payments ?? []).length > 0 && (
        <Section title="Payments">
          <ul className="divide-y divide-line text-sm">
            {(payments ?? []).map((p: any) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {formatDate(p.paid_at ?? p.created_at)} · {PLAN_LABELS[p.plan_key] ?? p.plan_key} {p.interval === "yearly" ? "(year)" : "(month)"} ·{" "}
                  <span className="text-ink/60">{p.kind === "manual" ? "EFT/cash" : p.kind === "renewal" ? "card renewal" : "card"}</span>
                </span>
                <span className="flex items-center gap-3">
                  {p.invoice_no != null && <span className="text-xs text-ink/50">{invoiceNumber(p.invoice_no)}</span>}
                  <span className="font-semibold tabular-nums">{formatMoney(p.amount_cents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

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

        <Section title="Advanced subscription settings" description="Change the plan, status, dates or a special price by hand. Takes effect immediately.">
          <details>
            <summary className="btn-secondary cursor-pointer list-none">Open settings</summary>
            <div className="mt-4">
              <SubscriptionForm churchId={church.id} churchName={church.name} sub={sub} />
            </div>
          </details>
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
      <Section title="Danger zone">
        <DeleteChurchForm churchId={church.id} churchName={church.name} people={people?.length ?? 0} />
      </Section>
    </div>
  );
}
