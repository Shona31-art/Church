import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { defaultReferencePrefix } from "@/lib/giving";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { Alert } from "@/components/ui/Alert";
import { GivingDetailsForm } from "./GivingDetailsForm";
import { CardGivingSection, type CardGivingState } from "./CardGivingSection";
import { bankForBranchCode } from "@/lib/banks-za";
import { paystackConfigured } from "@/lib/paystack";

// Church admin: the bank account members give into (giving by bank transfer,
// docs/plans/eft-giving.md). Members never see this page — only the details,
// on the Giving page.
export default async function GivingDetailsPage() {
  const gate = await moduleGate("giving");
  if (gate) return gate;
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageChurchProfile")) {
    return <PermissionDenied message="Only church admins can change the bank details for giving." backHref="/dashboard/setup" />;
  }

  const supabase = createClient();
  const [{ data: details, error }, { data: church }, { data: card }] = await Promise.all([
    supabase
      .from("church_giving_details")
      .select("account_name, bank_name, account_number, branch_code, account_type, reference_prefix, updated_at, app_users!church_giving_details_updated_by_fkey(name)")
      .eq("church_id", me.church_id)
      .maybeSingle(),
    supabase.from("churches").select("name").eq("id", me.church_id).maybeSingle(),
    // Before migration #31 this table doesn't exist; card giving then just shows as off.
    supabase.from("church_card_giving").select("enabled, account_ending, bank_code").eq("church_id", me.church_id).maybeSingle(),
  ]);

  const bank = details ? bankForBranchCode(details.branch_code) : undefined;
  const bankLabel = details ? `${bank?.name ?? details.bank_name} account ending ${details.account_number.slice(-4)}` : "";
  const cardState: CardGivingState = !paystackConfigured()
    ? { kind: "unavailable" }
    : !details
      ? { kind: "no_details" }
      : card?.enabled
        ? { kind: "on", bankLabel }
        : !bank
          ? { kind: "bank_not_listed" }
          : card && (card.account_ending !== details.account_number.slice(-4) || card.bank_code !== bank.code)
            ? { kind: "paused", detailsUpdatedAt: details.updated_at, bankLabel } // bank changed since it was on
            : { kind: "off", detailsUpdatedAt: details.updated_at, bankLabel };
  if (error) console.error("[setup] giving details load failed:", error.message);

  const lastChange = details?.updated_at
    ? `Last changed ${formatDateTime(details.updated_at)}${(details as any).app_users?.name ? ` by ${(details as any).app_users.name}` : ""}.`
    : null;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/setup", label: "Church settings" }}
        title="Bank details for giving"
        description="Members pay into this account from their own banking app, using a personal reference, then record the gift here for you to confirm."
      />
      {error ? (
        <Alert tone={error.code === "42P01" ? "info" : "error"}>
          {error.code === "42P01"
            ? "Giving by bank transfer will be available once your church's database update (#30) is installed."
            : "Couldn't load the bank details — refresh to try again."}
        </Alert>
      ) : (
        <GivingDetailsForm
          details={details ?? null}
          suggestedPrefix={defaultReferencePrefix(church?.name ?? "")}
          sampleUserId={me.id}
          lastChange={lastChange}
        />
      )}
      {!error && <CardGivingSection state={cardState} />}
    </div>
  );
}
