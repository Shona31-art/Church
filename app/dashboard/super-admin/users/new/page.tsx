import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateUserForm } from "../../SuperAdminForms";

export default async function NewPlatformUserPage({ searchParams }: { searchParams: { church?: string } }) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;

  const supabase = createClient();
  const [{ data: churches }, { data: departments }] = await Promise.all([
    supabase.from("churches").select("id, name").order("name").limit(2000),
    supabase.from("departments").select("id, name, church_id").order("name").limit(10000),
  ]);

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/super-admin/users", label: "Platform users" }}
        title="Add user"
        description="Creates a login that works immediately with the password you set. Church admins can also invite people themselves from their Members page."
      />
      {churches?.length ? <CreateUserForm churches={churches} departments={departments ?? []} defaultChurchId={churches.some((c) => c.id === searchParams.church) ? searchParams.church : undefined} /> : <EmptyState title="Create a church first" description="Every user belongs to a church." />}
    </div>
  );
}
