import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { APP_TIMEZONE } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { EventForm } from "../EventForm";

export default async function NewEventPage() {
  const gate = await moduleGate("calendar");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "createEvents")) {
    return <PermissionDenied message="Only pastors, church admins and department leaders can create events." backHref="/dashboard/calendar" />;
  }

  const { data: departments } = await createClient().from("departments").select("id, name").eq("church_id", me.church_id).order("name");

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/calendar", label: "Calendar" }} title="Create event" />
      <EventForm departments={departments ?? []} canPostChurchWide={can(me.role, "postChurchWide")} timezoneLabel={`Times are in ${APP_TIMEZONE.replace("_", " ")} time.`} />
    </div>
  );
}
