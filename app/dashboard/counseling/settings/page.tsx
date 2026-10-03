import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { SettingsForm } from "../CounselingForms";

export default async function CounselingSettingsPage() {
  const gate = await moduleGate("ai_counseling");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "configureCounseling")) {
    return <PermissionDenied message="Only church admins and pastors can change counseling settings." backHref="/dashboard/counseling" />;
  }

  const supabase = createClient();
  const [{ data: settings }, { data: pastors }] = await Promise.all([
    supabase.from("counseling_settings").select("*").eq("church_id", me.church_id).maybeSingle(),
    supabase.from("app_users").select("id, name").eq("church_id", me.church_id).in("role", ["pastor", "church_admin"]).neq("status", "disabled").order("name"),
  ]);

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/counseling", label: "Counseling" }} title="Counseling settings" />
      <SettingsForm
        enabled={Boolean(settings?.enabled)}
        stance={settings?.theological_stance ?? ""}
        escalationPastorId={settings?.escalation_pastor_id ?? ""}
        pastors={pastors ?? []}
      />
    </div>
  );
}
