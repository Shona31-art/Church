import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { fundLabel } from "@/lib/giving";
import { formatDate, formatMoney, todayInAppZone } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { GivingForm } from "./GivingForm";

const STATUS: Record<string, { tone: "success" | "warning" | "danger"; label: string }> = {
  succeeded: { tone: "success", label: "Received" },
  pending: { tone: "warning", label: "Not completed" },
  failed: { tone: "danger", label: "Failed" },
};

export default async function GivingPage({ searchParams }: { searchParams: { given?: string } }) {
  const gate = await moduleGate("giving");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const year = todayInAppZone().slice(0, 4);
  const supabase = createClient();
  const [{ data: recent, error }, { data: yearRows }] = await Promise.all([
    supabase.from("givings").select("id, amount_cents, fund, status, created_at").eq("user_id", me.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("givings").select("amount_cents").eq("user_id", me.id).eq("status", "succeeded").gte("created_at", `${year}-01-01T00:00:00Z`).limit(5000),
  ]);

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const totalThisYear = (yearRows ?? []).reduce((sum, g) => sum + g.amount_cents, 0);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Giving"
        description="Give your tithes and offerings securely by card. Your own giving history is always here."
        actions={
          can(me.role, "viewGivingReport") ? (
            <Link href="/dashboard/giving/report" className="btn-secondary">
              Church giving report
            </Link>
          ) : null
        }
      />

      {searchParams.given === "success" && (
        <Alert tone="success" title="Thank you for your gift" className="mb-4">
          Your payment is being confirmed and will show as received below within a minute.
        </Alert>
      )}
      {searchParams.given === "cancelled" && <Alert tone="info" className="mb-4">Checkout was cancelled — you haven&apos;t been charged.</Alert>}
      {!stripeConfigured && (
        <Alert tone="warning" title="Online giving isn't set up yet" className="mb-4">
          {can(me.role, "manageBilling") ? "Connect Stripe (see the README) to accept card gifts." : "Your church admin needs to connect a payment provider."}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GivingForm disabled={!stripeConfigured} />

        <div className="space-y-6">
          <div className="card-elevated rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wide text-ink/60">Given in {year}</p>
            <p className="text-3xl font-semibold tabular-nums mt-1">{formatMoney(totalThisYear)}</p>
          </div>

          <Section title="My giving history">
            {error ? (
              <Alert tone="error">Couldn&apos;t load your history — refresh to try again.</Alert>
            ) : !recent?.length ? (
              <p className="text-sm text-ink/60">No gifts yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p>{fundLabel(g.fund)}</p>
                      <p className="text-xs text-ink/60">{formatDate(g.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">{formatMoney(g.amount_cents)}</p>
                      <StatusBadge tone={STATUS[g.status]?.tone ?? "warning"}>{STATUS[g.status]?.label ?? g.status}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
