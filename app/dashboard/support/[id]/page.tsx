import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { ATTACHMENT_BUCKET } from "@/lib/support";
import { ReplyForm } from "./ReplyForm";
import { StatusButtons } from "./StatusButtons";

// Signed links last an hour — long enough to read a ticket, short enough that
// a copied link stops working. Works whether the bucket is public or private.
const SIGNED_LINK_SECONDS = 60 * 60;

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("support");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*, churches(name)")
    .eq("id", params.id)
    .single();
  if (!ticket) notFound();

  const { data: messages, error: messagesError } = await supabase
    .from("support_ticket_messages")
    .select("id, content, attachment_path, created_at, app_users(name, role)")
    .eq("ticket_id", params.id)
    .order("created_at");
  if (messagesError) console.error("[support] messages load failed:", messagesError.message);

  // Storage RLS (support_security_fix.sql) only signs files on tickets this
  // user can see; anything it refuses is simply shown as unavailable.
  const paths = (messages ?? []).map((m) => m.attachment_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, SIGNED_LINK_SECONDS);
    if (error) console.error("[support] signing attachments failed:", error.message);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const canManage = me?.role === "super_admin" || (me?.role === "church_admin" && me.church_id === ticket.church_id);

  return (
    <div className="max-w-lg">
      <Link href="/dashboard/support" className="text-sm text-ink/50 hover:text-ink">← Support</Link>
      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <span className="text-xs capitalize text-ink/50">{ticket.status.replace("_", " ")}</span>
      </div>
      {me?.role === "super_admin" && <p className="text-xs text-ink/40 mb-4">{ticket.churches?.name}</p>}

      <div className="space-y-3 my-6">
        {messages?.map((m: any) => (
          <div key={m.id} className="border border-ink/10 rounded-lg p-3 bg-white/60 text-sm">
            <p className="text-xs text-ink/40 mb-1">
              {m.app_users?.name ?? "Former member"} · {new Date(m.created_at).toLocaleString()}
            </p>
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.attachment_path &&
              (signed.get(m.attachment_path) ? (
                <a href={signed.get(m.attachment_path)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                  <img src={signed.get(m.attachment_path)} alt="Screenshot attached to this message" className="max-h-48 rounded-lg border border-ink/10" />
                </a>
              ) : (
                <p className="text-xs text-ink/40 mt-2">📎 Attachment unavailable — refresh the page to try again.</p>
              ))}
          </div>
        ))}
        {messagesError && (
          <p role="alert" className="text-sm text-red-700">⚠ Couldn't load the messages — refresh the page to try again.</p>
        )}
        {!messagesError && !messages?.length && <p className="text-sm text-ink/40">No messages on this ticket yet.</p>}
      </div>

      {ticket.status !== "closed" && <ReplyForm ticketId={params.id} />}
      {ticket.status === "closed" && (
        <p className="text-sm text-ink/50 mb-4">This ticket is closed. Open a new ticket if the problem comes back.</p>
      )}

      {canManage && <StatusButtons ticketId={params.id} status={ticket.status} />}
    </div>
  );
}
