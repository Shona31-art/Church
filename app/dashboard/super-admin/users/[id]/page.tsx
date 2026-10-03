import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { roleLabel, type AccountStatus } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { MemberStatusBadge } from "@/app/dashboard/members/MemberBadges";
import { DeleteUserForm, EditUserForm, SetPasswordForm, UserStatusButton } from "../../SuperAdminForms";

export default async function PlatformUserPage({ params }: { params: { id: string } }) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: user }, { data: churches }, { data: departments }] = await Promise.all([
    supabase.from("app_users").select("id, name, email, phone, role, status, church_id, department_id, created_at, churches(name)").eq("id", params.id).maybeSingle(),
    supabase.from("churches").select("id, name").order("name").limit(2000),
    supabase.from("departments").select("id, name, church_id").order("name").limit(10000),
  ]);
  if (!user) notFound();

  // Last sign-in lives in Supabase Auth, not our tables (service role, read-only).
  const { data: auth } = await createAdminClient().auth.admin.getUserById(user.id);
  const isPlatformAdmin = user.role === "super_admin";
  const isSelf = user.id === me.id;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/super-admin/users", label: "Platform users" }}
        title={user.name}
        description={user.email}
        meta={
          <>
            <StatusBadge tone="neutral">{roleLabel(user.role)}</StatusBadge>
            <MemberStatusBadge status={user.status as AccountStatus} />
          </>
        }
      />

      <Section title="Account">
        <DetailList
          items={[
            {
              label: "Church",
              value: user.church_id ? (
                <Link href={`/dashboard/super-admin/churches/${user.church_id}`} className="link">
                  {(user as any).churches?.name}
                </Link>
              ) : (
                "Platform"
              ),
            },
            { label: "Phone", value: user.phone },
            { label: "Created", value: formatDateTime(user.created_at) },
            { label: "Last sign-in", value: auth?.user?.last_sign_in_at ? formatDateTime(auth.user.last_sign_in_at) : "Never" },
            { label: "Email confirmed", value: auth?.user?.email_confirmed_at ? "Yes" : "No" },
          ]}
        />
      </Section>

      {isPlatformAdmin ? (
        <Alert tone="info">Platform admin accounts are managed directly in the database (see README) and can&apos;t be changed here.</Alert>
      ) : (
        <>
          <Section title="Profile and church">
            <EditUserForm
              user={{ id: user.id, name: user.name, phone: user.phone, church_id: user.church_id!, role: user.role, department_id: user.department_id }}
              churches={churches ?? []}
              departments={departments ?? []}
            />
          </Section>

          <Section title="Sign-in">
            <SetPasswordForm userId={user.id} />
            <p className="text-xs text-ink/60 mt-3">Prefer a reset email? Ask them to use “Forgot password” on the sign-in page.</p>
          </Section>

          <Section title="Access">
            <div className="flex flex-wrap gap-2">
              <UserStatusButton userId={user.id} name={user.name} status={user.status} />
              {!isSelf && <DeleteUserForm userId={user.id} name={user.name} />}
            </div>
          </Section>
        </>
      )}

      {isPlatformAdmin && isSelf && (
        <Section title="Your password">
          <SetPasswordForm userId={user.id} />
        </Section>
      )}
    </div>
  );
}
