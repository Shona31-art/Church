import Link from "next/link";
import { HapticOnMount } from "@/components/Haptics";
import { Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { ACCOUNT_TYPE_LABELS, cardFeeRateFromEnv, eftReference, fundLabel } from "@/lib/giving";
import { paystackConfigured } from "@/lib/paystack";
import { formatDate, formatMoney, todayInAppZone } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { GivingForm } from "./GivingForm";
import { BankDetails } from "./BankDetails";
import { TransferForm } from "./TransferForm";
import { DeleteTransferButton } from "./DeleteTransferButton";

// Giving: by bank transfer (ADR-0004) — the church's own account, a personal
// reference, and "I've made a transfer" for the church admin to confirm.
// Card giving (Paystack) appears when the platform has Paystack connected and
// this church has turned it on (Church settings → Bank details for giving).

const STATUS: Record<string, { tone: "success" | "warning" | "danger" | "info"; label: string }> = {
  succeeded: { tone: "success", label: "Received" },
  reported: { tone: "info", label: "Waiting for confirmation" },
  not_received: { tone: "danger", label: "Not received" },
  pending: { tone: "warning", label: "Not completed" },
  failed: { tone: "danger", label: "Failed" },
};

// PostgREST says this when migration #30 hasn't been run yet.
const missingTable = (code?: string) => code === "42P01" || code === "PGRST205";

export default async function GivingPage({ searchParams }: { searchParams: { card?: string } }) {
  const gate = await moduleGate("giving");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const year = todayInAppZone().slice(0, 4);
  const supabase = createClient();
  const [{ data: recent, error }, { data: yearRows }, { data: details, error: detailsError }, { data: card }] = await Promise.all([
    supabase
      .from("givings")
      .select("id, amount_cents, fund, status, method, paid_on, created_at")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("givings").select("amount_cents").eq("user_id", me.id).eq("status", "succeeded").gte("created_at", `${year}-01-01T00:00:00Z`).limit(5000),
    supabase
      .from("church_giving_details")
      .select("account_name, bank_name, account_number, branch_code, account_type, reference_prefix, updated_at")
      .eq("church_id", me.church_id)
      .maybeSingle(),
    supabase.from("church_card_giving").select("enabled").eq("church_id", me.church_id).maybeSingle(),
  ]);
  if (detailsError && !missingTable(detailsError.code)) console.error("[giving] bank details load failed:", detailsError.message);

  const cardAvailable = paystackConfigured() && Boolean(card?.enabled);
  const totalThisYear = (yearRows ?? []).reduce((sum, g) => sum + g.amount_cents, 0);
  const isAdmin = can(me.role, "manageChurchProfile");

  return (
    <div className="max-w-5xl">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Giving"
        description="Give your tithes and offerings straight to your church's bank account. Your own giving history is always here."
        actions={
          can(me.role, "viewGivingReport") ? (
            <Link href="/dashboard/giving/report" className="btn-secondary">
              Church giving report
            </Link>
          ) : null
        }
      />

      {/* Set by /api/giving/paystack/return after asking Paystack what happened. */}
      {searchParams.card === "received" && (
        <Alert tone="success" title="Thank you for your gift" className="mb-4">
          <HapticOnMount />
          Your card gift was received. It&apos;s in your history below.
        </Alert>
      )}
      {searchParams.card === "failed" && (
        <Alert tone="error" title="The card payment didn't go through" className="mb-4">
          You haven&apos;t been charged. You can try again, or give by bank transfer.
        </Alert>
      )}
      {(searchParams.card === "pending" || searchParams.card === "unconfirmed") && (
        <Alert tone="info" className="mb-4">
          Paystack is still confirming your payment. It will show as received below once it&apos;s done — there&apos;s no need to pay again.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-6">
          {missingTable(detailsError?.code) ? (
            <Alert tone="info">Giving by bank transfer will be available once your church&apos;s database update (#30) is installed.</Alert>
          ) : detailsError ? (
            <Alert tone="error">Couldn&apos;t load your church&apos;s bank details — refresh to try again.</Alert>
          ) : !details ? (
            <EmptyState
              icon={Landmark}
              title="Bank details not added yet"
              description={
                isAdmin
                  ? "Add the account members should give into. They'll see it here with their own payment reference."
                  : "Your church hasn't added its bank details for giving yet. Ask your church office how to give in the meantime."
              }
              action={
                isAdmin ? (
                  <Link href="/dashboard/setup/giving" className="btn-primary">
                    Add bank details
                  </Link>
                ) : null
              }
            />
          ) : (
            <>
              <Section title="1. Pay from your banking app" description="Use these details and your personal reference.">
                <BankDetails
                  rows={[
                    { label: "Account holder", value: details.account_name },
                    { label: "Bank", value: details.bank_name },
                    { label: "Account number", value: details.account_number, copy: true },
                    { label: "Branch code", value: details.branch_code, copy: true },
                    { label: "Account type", value: ACCOUNT_TYPE_LABELS[details.account_type as keyof typeof ACCOUNT_TYPE_LABELS] ?? details.account_type },
                  ]}
                  reference={eftReference(details.reference_prefix, me.id)}
                  lastChanged={`Details last changed ${formatDate(details.updated_at, { weekday: undefined })}.`}
                />
              </Section>
              <Section title="2. Record your gift" description="So it shows in your history. Your church confirms it once the money arrives.">
                <TransferForm today={todayInAppZone()} />
              </Section>
            </>
          )}

          {cardAvailable && (
            <Section title="Give by card" description="A one-off gift by card, paid into your church's bank account.">
              <GivingForm feeRate={cardFeeRateFromEnv()} />
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <div className="card-elevated rounded-2xl p-5">
            <p className="eyebrow">Received in {year}</p>
            <p className="tabular mt-1 text-3xl font-semibold">{formatMoney(totalThisYear)}</p>
            <p className="mt-1 text-xs text-ink/60">Counts gifts your church has confirmed.</p>
          </div>

          <Section title="My giving history">
            {error ? (
              <Alert tone="error">Couldn&apos;t load your history — refresh to try again.</Alert>
            ) : !recent?.length ? (
              <p className="text-sm text-ink/60">No gifts yet. Gifts you record or give appear here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((g: any) => {
                  const status = STATUS[g.status] ?? { tone: "warning" as const, label: g.status };
                  const when = g.method === "eft" && g.paid_on ? g.paid_on : g.created_at;
                  return (
                    <li key={g.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{fundLabel(g.fund)}</p>
                        <p className="text-xs text-ink/60">
                          {formatDate(when, { weekday: undefined })} · {g.method === "eft" ? "Bank transfer" : "Card"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <p className="tabular font-semibold">{formatMoney(g.amount_cents)}</p>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        {g.method === "eft" && g.status === "reported" && (
                          <DeleteTransferButton giftId={g.id} summary={`Your ${formatMoney(g.amount_cents)} gift to the ${fundLabel(g.fund)}`} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
