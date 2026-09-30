import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { MemberEditForm, DangerZone } from "./MemberEditForms";

export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("members");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return <p className="text-ink/60">Only church admins and pastors can edit members.</p>;
  }

  const supabase = createClient();
  const [{ data: member }, { data: departments }, { data: birthday }] = await Promise.all([
    supabase
      .from("app_users")
      .select("id, name, email, phone, role, status, department_id, created_at")
      .eq("id", params.id)
      .eq("church_id", me.church_id) // can't open someone from another church even if RLS were misconfigured
      .maybeSingle(),
    supabase.from("departments").select("id, name").eq("church_id", me.church_id).order("name"),
    supabase.from("member_birthdays").select("birth_date").eq("user_id", params.id).maybeSingle(),
  ]);

  if (!member) notFound();

  const isSelf = member.id === me.id;
  const canTouchAdmin = member.role !== "church_admin" || me.role === "church_admin";

  return (
    <div className="max-w-md space-y-8">
      <div>
        <Link href="/dashboard/members" className="text-sm text-ink/50 hover:text-ink">← Members</Link>
        <h1 className="text-2xl font-semibold mt-2">{member.name}</h1>
        <p className="text-ink/50 text-sm">{member.email}{member.phone ? ` · ${member.phone}` : ""}</p>
        <div className="flex flex-wrap gap-3 mt-3 text-sm">
          <Link href={`/dashboard/pastoral-care/new?member=${member.id}`} className="text-ember hover:underline">Record pastoral care</Link>
          {me.role === "church_admin" && (
            // Plain link, not <Link>: this is a file download from an API route.
            <a href={`/api/members/${member.id}/export`} className="text-ember hover:underline">Export their data (POPIA)</a>
          )}
        </div>
      </div>

      <MemberEditForm
        member={member}
        birthDate={birthday?.birth_date ?? ""}
        departments={departments ?? []}
        viewerRole={me.role}
        isSelf={isSelf}
      />

      {!isSelf && (
        <DangerZone
          memberId={member.id}
          memberName={member.name}
          canDeactivate={canTouchAdmin && member.status !== "disabled"}
          canDelete={me.role === "church_admin"}
        />
      )}
    </div>
  );
}
