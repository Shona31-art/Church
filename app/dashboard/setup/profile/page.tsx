import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { Alert } from "@/components/ui/Alert";
import { ProfileForm } from "./ProfileForm";

export default async function ChurchProfilePage() {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageChurchProfile")) {
    return <PermissionDenied message="Only church admins can edit the church profile." />;
  }
  const { data: church } = await createClient().from("churches").select("name, email, phone, address, logo_url").eq("id", me.church_id).maybeSingle();

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/setup", label: "Church settings" }} title="Church profile" />
      {church ? <ProfileForm church={church} /> : <Alert tone="error">Couldn&apos;t load your church&apos;s details — refresh to try again.</Alert>}
    </div>
  );
}
