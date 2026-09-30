import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { updateTicketStatus } from "./actions";
import { ReplyForm } from "./ReplyForm";

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

  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("*, app_users(name, role)")
    .eq("ticket_id", params.id)
    .order("created_at");

  const canManage = me!.role === "super_admin" || (me!.role === "church_admin" && me!.church_id === ticket.church_id);
  const updateStatusForTicket = updateTicketStatus.bind(null, params.id);

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <span className="text-xs capitalize text-ink/50">{ticket.status.replace("_", " ")}</span>
      </div>
      {me?.role === "super_admin" && (
        <p className="text-xs text-ink/40 mb-4">{ticket.churches?.name}</p>
      )}

      <div className="space-y-3 mb-6">
        {messages?.map((m: any) => (
          <div key={m.id} className="border border-ink/10 rounded-lg p-3 bg-white/60 text-sm">
            <p className="text-xs text-ink/40 mb-1">
              {m.app_users?.name} · {new Date(m.created_at).toLocaleString()}
            </p>
            <p>{m.content}</p>
            {m.attachment_url && (
              <img src={m.attachment_url} alt="Attachment" className="mt-2 max-h-48 rounded-lg border border-ink/10" />
            )}
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && <ReplyForm ticketId={params.id} />}

      {canManage && (
        <div className="flex gap-2">
          {["open", "in_progress", "closed"].map((s) => (
            <form key={s} action={updateStatusForTicket}>
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                className={`text-xs px-3 py-1.5 rounded-lg capitalize ${
                  ticket.status === s ? "bg-ember text-white" : "border border-ink/20"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
