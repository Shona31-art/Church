import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function CounselingSettingsPage() {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return <p className="text-ink/60">Only church admins and pastors can change this.</p>;
  }

  const supabase = createClient();
  const { data: settings } = await supabase
    .from("counseling_settings")
    .select("*")
    .eq("church_id", me.church_id)
    .maybeSingle();

  const { data: pastors } = await supabase
    .from("app_users")
    .select("id, name")
    .eq("church_id", me.church_id)
    .in("role", ["pastor", "church_admin"]);

  async function saveSettings(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["church_admin", "pastor"].includes(me.role)) return;

    const supabase = createClient();
    await supabase.from("counseling_settings").upsert({
      church_id: me.church_id,
      enabled: formData.get("enabled") === "on",
      theological_stance: String(formData.get("theological_stance") || ""),
      escalation_pastor_id: String(formData.get("escalation_pastor_id") || "") || null,
    });

    redirect("/dashboard/counseling/settings");
  }

  return (
    <form action={saveSettings} className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold mb-4">AI Counseling settings</h1>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={settings?.enabled} />
        Enable AI Counseling for members
      </label>

      <div>
        <label className="text-xs text-ink/40">
          Theological guidance (optional — shapes the tone of AI responses)
        </label>
        <textarea
          name="theological_stance"
          defaultValue={settings?.theological_stance ?? ""}
          rows={3}
          placeholder="e.g. 'Reformed Baptist, emphasize God's sovereignty and grace...'"
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
      </div>

      <div>
        <label className="text-xs text-ink/40">
          Who should be notified if a crisis is detected?
        </label>
        <select
          name="escalation_pastor_id"
          defaultValue={settings?.escalation_pastor_id ?? ""}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        >
          <option value="">Any pastor/admin (fallback)</option>
          {pastors?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
        Save settings
      </button>
    </form>
  );
}
