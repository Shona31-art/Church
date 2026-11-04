import { moduleGate } from "@/lib/gate";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { localInputToUtcIso, todayInAppZone, utcIsoToLocalInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { LiveForm } from "../LiveForm";
import { liveFormOptions } from "../options";

export const metadata = { title: "Set up Live Sunday" };

/** The coming Sunday at 09:00 (today if it's Sunday). */
function nextSundayLocal(): string {
  const today = new Date(`${todayInAppZone()}T12:00:00Z`);
  const add = (7 - today.getUTCDay()) % 7;
  const d = new Date(today.getTime() + add * 86_400_000).toISOString().slice(0, 10);
  return utcIsoToLocalInput(localInputToUtcIso(`${d}T09:00`));
}

export default async function NewLivePage() {
  const gate = await moduleGate("live_sunday");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "planServices")) return <PermissionDenied message="Only pastors and church admins set up live services." backHref="/dashboard/live" />;
  const options = await liveFormOptions(me.church_id!);
  return (
    <div>
      <PageHeader back={{ href: "/dashboard/live", label: "Live Sunday" }} title="Set up a live service" />
      <LiveForm defaults={{ title: "Sunday Service", starts_local: nextSundayLocal() }} {...options} />
    </div>
  );
}
