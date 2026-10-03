import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, roleLabel } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { ATTACHMENT_BUCKET } from "@/lib/support";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { PriorityBadge, TicketStatusBadge } from "../SupportBadges";
import { ReplyForm } from "./ReplyForm";
import { StatusButtons } from "./StatusButtons";

// Signed links last an hour — long enough to read a ticket, short enough that
// a copied link stops working.
const SIGNED_LINK_SECONDS = 60 * 60;

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("support");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  // RLS: the creator, their church admin, or platform support.
  const { data: ticket } = await supabase.from("support_tickets").select("*, churches(name)").eq("id", params.id).maybeSingle();
  if (!ticket) notFound();

  const { data: messages, error: messagesError } = await supabase
    .from("support_ticket_messages")
    .select("id, content, attachment_path, created_at, sender_id, app_users(name, role)")
    .eq("ticket_id", params.id)
    .order("created_at");
  if (messagesError) console.error("[support] messages load failed:", messagesError.message);

  // Storage RLS (support_security_fix.sql) only signs files on tickets this
  // user can see; anything it refuses is shown as unavailable.
  const paths = (messages ?? []).map((m) => m.attachment_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, SIGNED_LINK_SECONDS);
    if (error) console.error("[support] signing attachments failed:", error.message);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const canManage = me.role === "super_admin" || (can(me.role, "manageSupportTickets") && me.church_id === ticket.church_id);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/support", label: me.role === "super_admin" ? "Support tickets" : "Support" }}
        title={ticket.subject}
        description={me.role === "super_admin" ? ticket.churches?.name : `Opened ${formatDateTime(ticket.created_at)}`}
        meta={
          <>
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </>
        }
      />

      <section aria-label="Conversation" className="space-y-3">
        {messagesError && <Alert tone="error">Couldn&apos;t load the messages — refresh the page to try again.</Alert>}
        {!messagesError && !messages?.length && <p className="text-sm text-ink/60">No messages on this ticket yet.</p>}
        {messages?.map((m: any) => {
          const fromSupport = m.app_users?.role === "super_admin";
          return (
            <article key={m.id} className={`rounded-2xl border p-4 text-sm ${fromSupport ? "bg-info-tint border-info-line" : "card-elevated"}`}>
              <p className="text-xs text-ink/60 mb-1">
                <span className="font-semibold text-ink">{m.app_users?.name ?? "Former member"}</span>
                {m.app_users?.role ? ` · ${fromSupport ? "Platform support" : roleLabel(m.app_users.role)}` : ""} · {formatDateTime(m.created_at)}
              </p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.attachment_path &&
                (signed.get(m.attachment_path) ? (
                  <a href={signed.get(m.attachment_path)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                    {/* Signed, short-lived storage URL — next/image can't optimise these. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signed.get(m.attachment_path)} alt="Screenshot attached to this message" className="max-h-48 rounded-lg border border-line" />
                  </a>
                ) : (
                  <p className="text-xs text-ink/60 mt-2">📎 Attachment unavailable — refresh the page to try again.</p>
                ))}
            </article>
          );
        })}
      </section>

      {ticket.status !== "closed" ? (
        <Section title="Reply">
          <ReplyForm ticketId={params.id} />
        </Section>
      ) : (
        <Alert tone="info">This ticket is closed. Replying isn&apos;t possible — open a new ticket if the problem comes back.</Alert>
      )}

      {canManage && (
        <Section title="Manage ticket">
          <StatusButtons ticketId={params.id} status={ticket.status} />
        </Section>
      )}
    </div>
  );
}
