import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function CounselingHome() {
  const access = await checkModuleAccess("ai_counseling");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("counseling_settings")
    .select("enabled")
    .eq("church_id", me!.church_id)
    .maybeSingle();

  if (!settings?.enabled) {
    return (
      <p className="text-ink/60 max-w-md">
        AI Counseling hasn't been turned on for your church yet. Ask your
        church admin to enable it in settings.
      </p>
    );
  }

  const { data: conversations } = await supabase
    .from("counseling_conversations")
    .select("id, started_at, last_message_at, flagged")
    .eq("member_id", me!.id)
    .order("last_message_at", { ascending: false });

  async function startConversation() {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("counseling_conversations")
      .insert({ church_id: me.church_id, member_id: me.id })
      .select("id")
      .single();

    if (data) redirect(`/dashboard/counseling/${data.id}`);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-2">Christian Counseling</h1>
      <p className="text-xs text-ink/50 mb-6 border border-ink/10 rounded-lg p-3 bg-white/60">
        This isn't a substitute for pastoral care, therapy, or medical help.
        In a crisis, this chat will point you to a real person immediately,
        and may notify a pastor so they can follow up with you directly.
      </p>

      <form action={startConversation} className="mb-8">
        <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
          Start a new conversation
        </button>
      </form>

      <div className="space-y-2">
        {conversations?.map((c) => (
          <a
            key={c.id}
            href={`/dashboard/counseling/${c.id}`}
            className="block border border-ink/10 rounded-lg p-3 bg-white/60 hover:bg-white text-sm"
          >
            {new Date(c.started_at).toLocaleDateString()}
            {c.flagged && <span className="ml-2 text-xs text-red-600">flagged</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
