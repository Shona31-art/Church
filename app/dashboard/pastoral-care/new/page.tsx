import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { LOG_TYPES, LogType } from "@/lib/pastoral-care";
import { CareLogForm } from "./CareLogForm";

export default async function NewCareLogPage({ searchParams }: { searchParams: { member?: string; type?: string } }) {
  const access = await checkModuleAccess("pastoral_care");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role)) {
    return <p className="text-ink/60">Only pastors and church admins can record pastoral care.</p>;
  }

  const supabase = createClient();
  const { data: members } = await supabase
    .from("app_users")
    .select("id, name")
    .eq("church_id", me.church_id)
    .neq("status", "disabled")
    .order("name")
    .limit(2000);

  const list = members ?? [];
  const defaultMemberId = list.some((m) => m.id === searchParams.member) ? searchParams.member : undefined;
  const defaultType = LOG_TYPES.includes(searchParams.type as LogType) ? searchParams.type : undefined;

  return <CareLogForm members={list} defaultMemberId={defaultMemberId} defaultType={defaultType} />;
}
