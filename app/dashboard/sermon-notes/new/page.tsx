import { moduleGate } from "@/lib/gate";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { todayInAppZone } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { OutlineForm } from "../OutlineForms";

export const metadata = { title: "New sermon notes" };

export default async function NewSermonNotesPage() {
  const gate = await moduleGate("sermon_notes");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "manageSermons")) return <PermissionDenied message="Only pastors and church admins write sermon notes." backHref="/dashboard/sermon-notes" />;
  return (
    <div>
      <PageHeader back={{ href: "/dashboard/sermon-notes", label: "Sermon notes" }} title="New sermon notes" />
      <OutlineForm today={todayInAppZone()} />
    </div>
  );
}
