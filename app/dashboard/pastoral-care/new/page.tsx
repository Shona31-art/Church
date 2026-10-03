import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { LOG_TYPES, type LogType } from "@/lib/pastoral-care";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { CareLogForm } from "../CareLogForm";

export default async function NewCareLogPage({ searchParams }: { searchParams: { member?: string; type?: string } }) {
  const gate = await moduleGate("pastoral_care");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "pastoralCare")) {
    return <PermissionDenied message="Only pastors and church admins can record pastoral care." />;
  }

  const { data: members } = await createClient()
    .from("app_users")
    .select("id, name")
    .eq("church_id", me.church_id)
    .neq("status", "disabled")
    .order("name")
    .limit(2000);

  const list = members ?? [];
  const defaultMemberId = list.some((m) => m.id === searchParams.member) ? searchParams.member : undefined;
  const defaultType = LOG_TYPES.includes(searchParams.type as LogType) ? searchParams.type : undefined;

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/pastoral-care", label: "Pastoral care" }} title="Record pastoral care" />
      <CareLogForm members={list} defaultMemberId={defaultMemberId} defaultType={defaultType} />
    </div>
  );
}
