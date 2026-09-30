import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { EventForm } from "./EventForm";

export default async function NewEventPage() {
  const access = await checkModuleAccess("calendar");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor", "department_leader"].includes(me.role)) {
    return <p className="text-ink/60">You don't have permission to create events.</p>;
  }

  const supabase = createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("church_id", me.church_id);

  return (
    <EventForm
      departments={departments || []}
      canPostChurchWide={["church_admin", "pastor"].includes(me.role)}
    />
  );
}
