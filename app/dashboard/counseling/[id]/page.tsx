import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { SA_CRISIS_RESOURCES } from "@/lib/crisis-detection";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AcknowledgeForm, MessageComposer, ShareToggle } from "../CounselingForms";

export default async function CounselingConversationPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("ai_counseling");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  // RLS returns this only to the member, or to a pastor/admin if it was
  // shared or flagged. Anyone else gets "not found".
  const { data: conversation } = await supabase
    .from("counseling_conversations")
    .select("*, member:app_users!counseling_conversations_member_id_fkey(name)")
    .eq("id", params.id)
    .eq("church_id", me.church_id)
    .maybeSingle();
  if (!conversation) notFound();

  const isOwner = conversation.member_id === me.id;
  const [{ data: messages, error }, { data: escalations }, { data: settings }] = await Promise.all([
    supabase.from("counseling_messages").select("id, sender, content, created_at").eq("conversation_id", params.id).order("created_at").limit(500),
    !isOwner && can(me.role, "reviewCounseling")
      ? supabase.from("counseling_escalations").select("id, acknowledged_at, outcome_notes, notified:app_users!counseling_escalations_notified_user_id_fkey(name)").eq("conversation_id", params.id)
      : Promise.resolve({ data: null }),
    supabase.from("counseling_settings").select("enabled").eq("church_id", me.church_id).maybeSingle(),
  ]);

  const openEscalation = (escalations ?? []).some((e: any) => !e.acknowledged_at);
  const acknowledged = (escalations ?? []).find((e: any) => e.acknowledged_at);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/counseling", label: "Counseling" }}
        title={isOwner ? "Conversation" : `Conversation with ${conversation.member?.name ?? "a member"}`}
        description={`Started ${formatDateTime(conversation.started_at)}`}
        meta={
          <>
            {conversation.flagged && <StatusBadge tone="danger">Safety flag</StatusBadge>}
            {conversation.shared_with_pastor && <StatusBadge tone="info">Shared with pastors</StatusBadge>}
          </>
        }
        actions={isOwner ? <ShareToggle conversationId={conversation.id} shared={conversation.shared_with_pastor} /> : null}
      />

      {isOwner && conversation.flagged && (
        <Alert tone="warning" title="A pastor has been told about this conversation">
          <p className="whitespace-pre-line">{SA_CRISIS_RESOURCES}</p>
        </Alert>
      )}

      {!isOwner && (
        <Alert tone="info">
          {conversation.flagged
            ? "You can see this conversation because crisis language was detected. Please reach out to the member directly."
            : "The member chose to share this conversation with their pastors."}
        </Alert>
      )}

      <section aria-label="Messages" className="card-elevated rounded-2xl p-4 sm:p-5">
        {error ? (
          <Alert tone="error">Couldn&apos;t load the messages — refresh the page to try again.</Alert>
        ) : !messages?.length ? (
          <p className="text-sm text-ink/60">Share what&apos;s on your mind — this is a safe place to start.</p>
        ) : (
          <ol className="space-y-3">
            {messages.map((m) => {
              const fromMember = m.sender === "member";
              return (
                <li key={m.id} className={`flex ${fromMember ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] whitespace-pre-wrap ${fromMember ? "bg-ember text-on-ember" : "bg-parchment border border-line"}`}>
                    <span className="sr-only">{fromMember ? (isOwner ? "You" : "Member") : "Assistant"}: </span>
                    {m.content}
                    <time className={`block mt-1 text-[11px] ${fromMember ? "text-on-ember/70" : "text-ink/60"}`} dateTime={m.created_at}>
                      {formatDateTime(m.created_at, { weekday: undefined })}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {isOwner && settings?.enabled && (
          <div className="mt-5 border-t border-line pt-4">
            <MessageComposer conversationId={conversation.id} />
            <p className="text-xs text-ink/60 mt-2">Not a substitute for pastoral care or professional help. In an emergency call 10111 or SADAG on 0800 567 567.</p>
          </div>
        )}
      </section>

      {!isOwner && conversation.flagged && (
        <Section title="Pastoral follow-up">
          {openEscalation ? (
            <AcknowledgeForm conversationId={conversation.id} />
          ) : acknowledged ? (
            <div className="text-sm">
              <p>Followed up {formatDateTime(acknowledged.acknowledged_at)}.</p>
              {acknowledged.outcome_notes && <p className="mt-2 text-ink/70 whitespace-pre-line">{acknowledged.outcome_notes}</p>}
            </div>
          ) : (
            <p className="text-sm text-ink/60">No escalation was recorded.</p>
          )}
        </Section>
      )}
    </div>
  );
}
