import Link from "next/link";
import { DeleteConversation } from "./DeleteConversation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDateTime, formatRelative } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { startConversation } from "./actions";
import { NAV_ICONS } from "@/components/ui/NavIcon";
import { PrivacyNote } from "@/components/ui/PrivacyNote";

export default async function CounselingHome() {
  const gate = await moduleGate("ai_counseling");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const reviewer = can(me.role, "reviewCounseling");
  const supabase = createClient();

  const [{ data: settings }, { data: mine }, review] = await Promise.all([
    supabase.from("counseling_settings").select("enabled").eq("church_id", me.church_id).maybeSingle(),
    supabase.from("counseling_conversations").select("id, started_at, last_message_at, flagged, shared_with_pastor").eq("member_id", me.id).order("last_message_at", { ascending: false }).limit(50),
    reviewer
      ? supabase
          .from("counseling_conversations")
          .select("id, last_message_at, flagged, flagged_at, shared_with_pastor, member:app_users!counseling_conversations_member_id_fkey(name), counseling_escalations(acknowledged_at)")
          .eq("church_id", me.church_id)
          .neq("member_id", me.id)
          .or("flagged.eq.true,shared_with_pastor.eq.true")
          .order("last_message_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
  ]);

  const enabled = Boolean(settings?.enabled);
  const reviewItems: any[] = review.data ?? [];
  const needsFollowUp = reviewItems.filter((c) => c.flagged && (c.counseling_escalations ?? []).some((e: any) => !e.acknowledged_at));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Christian counseling"
        description="A private, scripture-based space to talk things through. Not a substitute for pastoral care, therapy or medical help."
        actions={
          <>
            {can(me.role, "configureCounseling") && (
              <Link href="/dashboard/counseling/settings" className="btn-secondary">
                Settings
              </Link>
            )}
            {enabled && (
              <form action={startConversation}>
                <PendingButton pendingLabel="Starting…">New conversation</PendingButton>
              </form>
            )}
          </>
        }
      />

      {reviewer && (
        <Section title="Pastoral review" description="Conversations members shared with you, and ones flagged for safety. Others stay private.">
          {needsFollowUp.length > 0 && (
            <Alert tone="error" title={`${needsFollowUp.length} flagged conversation${needsFollowUp.length === 1 ? "" : "s"} need follow-up`} className="mb-4">
              Crisis language was detected. Reach out to the member, then mark it followed up.
            </Alert>
          )}
          {reviewItems.length === 0 ? (
            <p className="text-sm text-ink/60">Nothing to review. Members&apos; conversations are private unless they share them or a safety flag is raised.</p>
          ) : (
            <ul className="divide-y divide-line">
              {reviewItems.map((c) => {
                const open = c.flagged && (c.counseling_escalations ?? []).some((e: any) => !e.acknowledged_at);
                return (
                  <li key={c.id}>
                    <Link href={`/dashboard/counseling/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-ink/[0.02] -mx-2 px-2 rounded-lg">
                      <span className="font-medium">{c.member?.name ?? "Former member"}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        {open ? <StatusBadge tone="danger">Needs follow-up</StatusBadge> : c.flagged ? <StatusBadge tone="neutral">Followed up</StatusBadge> : null}
                        {c.shared_with_pastor && <StatusBadge tone="info">Shared</StatusBadge>}
                        <span className="text-xs text-ink/60">{formatRelative(c.last_message_at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      {!enabled ? (
        <EmptyState
          icon={NAV_ICONS.counseling}
          title="AI counseling isn't turned on for your church"
          description={can(me.role, "configureCounseling") ? "Turn it on in Settings when you're ready." : "Ask your church admin or pastor if they plan to enable it."}
          action={
            can(me.role, "configureCounseling") ? (
              <Link href="/dashboard/counseling/settings" className="btn-primary">
                Open settings
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Section title="My conversations" description={<PrivacyNote>Only you can read these unless you choose to share one with a pastor.</PrivacyNote>}>
          {!mine?.length ? (
            <p className="text-sm text-ink/60">You haven&apos;t started a conversation yet. Use “New conversation” whenever you&apos;re ready.</p>
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((c) => (
                <li key={c.id} className="flex items-center gap-1">
                  <Link href={`/dashboard/counseling/${c.id}`} className="-mx-2 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 hover:bg-ink/[0.02]">
                    <span className="text-sm">Started {formatDateTime(c.started_at)}</span>
                    <span className="flex gap-2">{c.shared_with_pastor && <StatusBadge tone="info">Shared with pastors</StatusBadge>}</span>
                  </Link>
                  <DeleteConversation id={c.id} compact />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
