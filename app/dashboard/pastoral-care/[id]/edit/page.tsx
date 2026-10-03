import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { CareLogForm } from "../../CareLogForm";

export default async function EditCareLogPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("pastoral_care");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "pastoralCare")) {
    return <PermissionDenied message="Only pastors and church admins can edit pastoral care records." />;
  }
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: log }, { data: members }] = await Promise.all([
    supabase
      .from("pastoral_care_logs")
      .select("id, updated_at, member_id, member_name, log_type, notes, location, follow_up_date")
      .eq("id", params.id)
      .eq("church_id", me.church_id)
      .maybeSingle(),
    supabase.from("app_users").select("id, name").eq("church_id", me.church_id).neq("status", "disabled").order("name").limit(2000),
  ]);
  if (!log) notFound();

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/pastoral-care", label: "Pastoral care" }} title={`Edit care record — ${log.member_name}`} />
      <CareLogForm members={members ?? []} log={log} />
    </div>
  );
}
