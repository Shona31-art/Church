import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, canEditMemberRole, roleLabel, type AccountStatus } from "@/lib/permissions";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PermissionDenied } from "@/components/ui/Gates";
import { MemberStatusBadge } from "../MemberBadges";
import { MemberAccountActions } from "./MemberAccountActions";
import { RemovePhotoButton } from "./RemovePhotoButton";
import { ChatRestrictions, type ActiveRestriction } from "./ChatRestrictions";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { BADGES, type BadgeKey } from "@/lib/games/progression";
import { ChildrenList } from "@/components/members/ChildrenList";
import { loadChildren } from "@/lib/children";

const ACTIVITY_LABELS: Record<string, string> = {
  "member.invited": "Added and invited",
  "member.invite_resent": "Invite email re-sent",
  "member.role_changed": "Role or department changed",
  "member.role_status_changed": "Role or status changed",
  "member.deactivated": "Deactivated",
  "member.reactivated": "Reactivated",
  "member.exported": "Personal data exported",
  "member.self_export": "Exported their own data",
  "member.photo_removed": "Profile photo removed",
  "member.chat_restricted": "Chat restricted",
  "member.chat_restriction_lifted": "Chat restriction lifted",
};

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("members");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "viewMembers")) {
    return <PermissionDenied message="Member profiles are only available to pastors and church admins." />;
  }
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: member }, { data: birthday }, { count: careCount }, { data: activity }] = await Promise.all([
    supabase
      .from("app_users")
      .select("id, name, email, phone, role, status, department_id, created_at, departments(name)")
      .eq("id", params.id)
      .eq("church_id", me.church_id) // a typed URL can never open another church's member
      .maybeSingle(),
    supabase.from("member_birthdays").select("birth_date").eq("user_id", params.id).maybeSingle(),
    supabase.from("pastoral_care_logs").select("id", { count: "exact", head: true }).eq("member_id", params.id),
    // RLS shows the audit log to church admins only; for pastors this is empty.
    supabase
      .from("audit_logs")
      .select("id, action, created_at, actor:app_users!audit_logs_actor_id_fkey(name)")
      .eq("target_id", params.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!member) notFound();

  const isSelf = member.id === me.id;
  const canEdit = member.role !== "church_admin" || me.role === "church_admin";
  const canChangeAccess = canEditMemberRole(me, member);
  const department = (member as any).departments?.name as string | undefined;
  const photoUrl = (await getAvatarUrls([member.id])).get(member.id) ?? null;
  const children = await loadChildren(member.id);
  // Bible games badges (bible_games_v3.sql); missing table → none shown.
  const { data: badgeRows } = await supabase.from("user_badges").select("badge_key").eq("user_id", member.id);
  const badgeTitles = (badgeRows ?? []).map((b) => BADGES[b.badge_key as BadgeKey]?.title).filter(Boolean);

  // Active chat restrictions (chat_v2.sql). Missing table → section hidden.
  const nowIso = new Date().toISOString();
  const { data: restrictionRows, error: restrictionError } = canChangeAccess
    ? await supabase
        .from("member_chat_restrictions")
        .select("id, kind, until, reason, created_at, setter:app_users!member_chat_restrictions_created_by_fkey(name)")
        .eq("user_id", member.id)
        .is("lifted_at", null)
        .or(`until.is.null,until.gt.${nowIso}`)
        .order("created_at", { ascending: false })
    : { data: null, error: null };
  const restrictions: ActiveRestriction[] = (restrictionRows ?? []).map((r: any) => ({
    id: r.id,
    kind: r.kind,
    until: r.until,
    reason: r.reason,
    createdAt: r.created_at,
    createdByName: r.setter?.name ?? "a former leader",
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/members", label: "Members" }}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={member.name} src={photoUrl} size="lg" />
            {member.name}
          </span>
        }
        meta={
          <>
            <StatusBadge tone="neutral">{roleLabel(member.role)}</StatusBadge>
            <MemberStatusBadge status={member.status as AccountStatus} />
            {isSelf && <StatusBadge tone="info">You</StatusBadge>}
          </>
        }
        actions={
          <>
            <Link href={`/dashboard/pastoral-care/new?member=${member.id}`} className="btn-secondary">
              Record pastoral care
            </Link>
            {photoUrl && canChangeAccess && <RemovePhotoButton memberId={member.id} memberName={member.name} />}
            {canEdit && (
              <Link href={`/dashboard/members/${member.id}/edit`} className="btn-primary">
                Edit
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Contact">
          <DetailList
            items={[
              { label: "Email", value: <a href={`mailto:${member.email}`} className="link">{member.email}</a> },
              { label: "Phone", value: member.phone ? <a href={`tel:${member.phone}`} className="link">{member.phone}</a> : null },
            ]}
          />
        </Section>

        <Section title="Church">
          <DetailList
            items={[
              { label: "Role", value: roleLabel(member.role) },
              { label: "Department", value: department },
              { label: "Birthday", value: birthday?.birth_date ? formatDate(birthday.birth_date, { weekday: undefined }) : null },
              { label: "Member since", value: formatDate(member.created_at, { weekday: undefined }) },
              ...(badgeTitles.length ? [{ label: "Game badges", value: badgeTitles.join(" · ") }] : []),
            ]}
          />
        </Section>
      </div>

      {children && (
        <Section title="Children" description="Names and birthdays — visible to the member, pastors and church admins only.">
          <ChildrenList parentId={member.id} items={children} self={isSelf} />
        </Section>
      )}

      <Section
        title="Login account"
        description="The member record above is your church's directory entry. Their login is how they sign in to the app."
      >
        <p className="text-sm text-ink/70">
          {member.status === "invited" && "Added by invite email, which they haven't accepted yet. You can set a password for them below instead."}
          {member.status === "active" && "They sign in with their email address and password. If they forget it, they can use “Forgot password” on the sign-in page, or you can set a new one below."}
          {member.status === "disabled" && "Deactivated — they can't sign in. Their records and history are kept, and you can reactivate them at any time."}
        </p>
        {!isSelf && (
          <MemberAccountActions
            memberId={member.id}
            memberName={member.name}
            status={member.status as AccountStatus}
            canChangeAccess={canChangeAccess}
            canDelete={can(me.role, "deleteMembers")}
            canExport={can(me.role, "exportMemberData")}
          />
        )}
      </Section>

      {canChangeAccess && !restrictionError && restrictionRows && (
        <Section title="Chat restrictions" description="Pause someone's group-chat posting or voice notes after misuse. Logged, and they see the reason.">
          <ChatRestrictions memberId={member.id} memberName={member.name} active={restrictions} />
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Pastoral care" description="Confidential — visible to pastors and church admins only.">
          <p className="text-sm">
            {careCount ? (
              <>
                {careCount} care {careCount === 1 ? "record" : "records"}.{" "}
                <Link href={`/dashboard/pastoral-care?q=${encodeURIComponent(member.name)}`} className="link">
                  View in care log
                </Link>
              </>
            ) : (
              <span className="text-ink/60">No care records yet.</span>
            )}
          </p>
        </Section>

        {me.role === "church_admin" && (
          <Section title="Recent activity" description="Changes made to this member's record.">
            {activity?.length ? (
              <ul className="space-y-2 text-sm">
                {activity.map((a: any) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {ACTIVITY_LABELS[a.action] ?? a.action}
                      {a.actor?.name ? <span className="text-ink/60"> · by {a.actor.name}</span> : null}
                    </span>
                    <time dateTime={a.created_at} className="text-xs text-ink/60">
                      {formatRelative(a.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/60">No recorded changes yet.</p>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
