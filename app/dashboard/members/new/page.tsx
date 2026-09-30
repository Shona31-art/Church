import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { MemberForm } from "./MemberForm";

export default async function NewMemberPage() {
  const access = await checkModuleAccess("members");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor", "super_admin"].includes(me.role)) {
    return <p className="text-ink/60">Only church admins and pastors can add members.</p>;
  }

  const supabase = createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("church_id", me.church_id);

  return <MemberForm departments={departments || []} canGrantAdmin={me.role === "church_admin"} />;
}
