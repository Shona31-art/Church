import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function ChurchProfilePage() {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return <p className="text-ink/60">Only church admins and pastors can edit this.</p>;
  }

  const supabase = createClient();
  const { data: church } = await supabase
    .from("churches")
    .select("*")
    .eq("id", me.church_id)
    .single();

  async function saveProfile(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["church_admin", "pastor"].includes(me.role)) return;

    const supabase = createClient();
    await supabase
      .from("churches")
      .update({
        name: String(formData.get("name") || ""),
        logo_url: String(formData.get("logo_url") || "") || null,
        address: String(formData.get("address") || ""),
        phone: String(formData.get("phone") || ""),
        email: String(formData.get("email") || ""),
      })
      .eq("id", me.church_id);

    redirect("/dashboard/setup");
  }

  return (
    <form action={saveProfile} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Church profile</h1>

      <input
        name="name"
        defaultValue={church?.name}
        placeholder="Church name"
        required
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="logo_url"
        defaultValue={church?.logo_url ?? ""}
        placeholder="Logo URL (optional)"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="address"
        defaultValue={church?.address ?? ""}
        placeholder="Address"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="phone"
        defaultValue={church?.phone ?? ""}
        placeholder="Phone"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="email"
        defaultValue={church?.email ?? ""}
        placeholder="Contact email"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />

      <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
        Save profile
      </button>
    </form>
  );
}
