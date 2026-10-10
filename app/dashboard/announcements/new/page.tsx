import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { aiAssistAvailable } from "@/lib/features";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { AnnouncementForm } from "../AnnouncementForm";

export default async function NewAnnouncementPage() {
  const gate = await moduleGate("announcements");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "postAnnouncements")) {
    return <PermissionDenied message="Only pastors, church admins and department leaders can post announcements." backHref="/dashboard/announcements" />;
  }

  const { data: departments } = await createClient().from("departments").select("id, name").eq("church_id", me.church_id).order("name");

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/announcements", label: "Announcements" }} title="New announcement" />
      <AnnouncementForm departments={departments ?? []} canPostChurchWide={can(me.role, "postChurchWide")} aiAvailable={await aiAssistAvailable()} />
    </div>
  );
}
