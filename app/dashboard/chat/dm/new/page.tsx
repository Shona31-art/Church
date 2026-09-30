import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function NewDirectMessagePage() {
  const access = await checkModuleAccess("dept_chats");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: members } = await supabase
    .from("app_users")
    .select("id, name, role")
    .eq("church_id", me!.church_id)
    .neq("id", me!.id)
    .order("name");

  async function startDm(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const otherUserId = String(formData.get("user_id") || "");
    if (!otherUserId) return;

    const supabase = createClient();

    // Reuse an existing DM if these two already have one — check every DM
    // channel I'm a member of, and see if the other person is also a member.
    const { data: myDmChannels } = await supabase
      .from("chat_channel_members")
      .select("channel_id, chat_channels!inner(is_dm)")
      .eq("user_id", me.id)
      .eq("chat_channels.is_dm", true);

    for (const row of myDmChannels || []) {
      const { data: otherMember } = await supabase
        .from("chat_channel_members")
        .select("user_id")
        .eq("channel_id", row.channel_id)
        .eq("user_id", otherUserId)
        .maybeSingle();
      if (otherMember) {
        redirect(`/dashboard/chat/${row.channel_id}`);
      }
    }

    // No existing thread — create one.
    const { data: channel } = await supabase
      .from("chat_channels")
      .insert({ church_id: me.church_id, is_dm: true, name: "Direct message" })
      .select("id")
      .single();

    if (channel) {
      await supabase.from("chat_channel_members").insert([
        { channel_id: channel.id, user_id: me.id },
        { channel_id: channel.id, user_id: otherUserId },
      ]);
      redirect(`/dashboard/chat/${channel.id}`);
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl font-semibold mb-6">New message</h1>
      <div className="space-y-2">
        {members?.map((m) => (
          <form key={m.id} action={startDm}>
            <input type="hidden" name="user_id" value={m.id} />
            <button
              type="submit"
              className="w-full text-left border border-ink/10 rounded-lg px-4 py-3 bg-white/60 hover:bg-white text-sm"
            >
              {m.name} <span className="text-xs text-ink/40 capitalize">· {m.role.replace("_", " ")}</span>
            </button>
          </form>
        ))}
        {!members?.length && <p className="text-ink/40 text-sm">No other members yet.</p>}
      </div>
    </div>
  );
}
