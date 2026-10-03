import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { isAiConfigured } from "@/lib/ai";
import { todayInAppZone } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { SermonForm } from "../SermonForm";

export default async function NewSermonPage() {
  const gate = await moduleGate("sermon_ai");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageSermons")) {
    return <PermissionDenied message="Only pastors and church admins can add sermons." backHref="/dashboard/sermons" />;
  }
  return (
    <div>
      <PageHeader back={{ href: "/dashboard/sermons", label: "Sermons" }} title="Add sermon" />
      <SermonForm aiAvailable={isAiConfigured()} today={todayInAppZone()} />
    </div>
  );
}
