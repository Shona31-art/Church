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
  const [{ data: details, error }, { data: church }] = await Promise.all([
    supabase
      .from("church_giving_details")
      .select("account_name, bank_name, account_number, branch_code, account_type, reference_prefix, updated_at, app_users!church_giving_details_updated_by_fkey(name)")
      .eq("church_id", me.church_id)
      .maybeSingle(),
    supabase.from("churches").select("name").eq("id", me.church_id).maybeSingle(),
  ]);
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
    </div>
  );
}
