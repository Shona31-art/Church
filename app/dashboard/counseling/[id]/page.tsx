import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { getCounselingReply } from "../actions";

export default async function CounselingChatPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("ai_counseling");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: conversation } = await supabase
    .from("counseling_conversations")
    .select("*")
    .eq("id", params.id)
    .eq("member_id", me!.id) // extra guard on top of RLS: this page only ever renders the member's own chat
    .single();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("counseling_messages")
    .select("*")
    .eq("conversation_id", params.id)
    .order("created_at");

  const { data: settings } = await supabase
    .from("counseling_settings")
    .select("*")
    .eq("church_id", me!.church_id)
    .maybeSingle();

  async function sendMessage(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const content = String(formData.get("content") || "").trim();
    if (!content) return;

    const supabase = createClient();

    await supabase.from("counseling_messages").insert({
      conversation_id: params.id,
      sender: "member",
      content,
    });

    const { data: history } = await supabase
      .from("counseling_messages")
      .select("sender, content")
      .eq("conversation_id", params.id)
      .order("created_at");

    const { data: settings } = await supabase
      .from("counseling_settings")
      .select("*")
      .eq("church_id", me.church_id)
      .maybeSingle();

    const { reply, isCrisis } = await getCounselingReply({
      history: (history || []) as any,
      theologicalStance: settings?.theological_stance,
    });

    await supabase.from("counseling_messages").insert({
      conversation_id: params.id,
      sender: "assistant",
      content: reply,
    });

    if (isCrisis) {
      await supabase
        .from("counseling_conversations")
        .update({ flagged: true, flagged_at: new Date().toISOString(), flagged_reason: "crisis_language_detected" })
        .eq("id", params.id);

      // Resolve who to notify: configured pastor, or fall back to any pastor/church_admin
      let notifyId = settings?.escalation_pastor_id;
      if (!notifyId) {
        const { data: fallback } = await supabase
          .from("app_users")
          .select("id")
          .eq("church_id", me.church_id)
          .in("role", ["pastor", "church_admin"])
          .limit(1)
          .maybeSingle();
        notifyId = fallback?.id;
      }

      await supabase.from("counseling_escalations").insert({
        conversation_id: params.id,
        notified_user_id: notifyId,
      });
      // In production: also send an actual notification (email/push) to
      // notifyId here — this insert alone doesn't page anyone yet.
    }

    redirect(`/dashboard/counseling/${params.id}`);
  }

  return (
    <div className="max-w-lg flex flex-col h-[80vh]">
      <h1 className="text-xl font-semibold mb-1">Conversation</h1>
      {conversation.flagged && (
        <p className="text-xs text-red-600 mb-2">
          A pastor has been notified about this conversation.
        </p>
      )}
      <p className="text-xs text-ink/40 mb-4">
        Not a substitute for pastoral care or professional help.
      </p>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages?.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl p-3 text-sm max-w-[85%] whitespace-pre-wrap ${
              m.sender === "member"
                ? "bg-ember text-white ml-auto"
                : "bg-white/70 border border-ink/10"
            }`}
          >
            {m.content}
          </div>
        ))}
        {!messages?.length && (
          <p className="text-ink/40 text-sm">
            Share what's on your mind — this is a safe place to start.
          </p>
        )}
      </div>

      <form action={sendMessage} className="flex gap-2">
        <input
          name="content"
          placeholder="Type your message..."
          required
          className="flex-1 border border-ink/20 rounded-lg px-4 py-3"
        />
        <button type="submit" className="bg-ember text-white px-5 py-3 rounded-lg font-medium">
          Send
        </button>
      </form>
    </div>
  );
}
