import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { PageHeader } from "@/components/ui/PageHeader";
import { EditPrayerForm } from "./EditPrayerForm";

export default async function EditPrayerPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("prayer_board");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const { data: item } = await createClient()
    .from("prayer_board_items")
    .select("id, prayer_text, category")
    .eq("id", params.id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!item) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit prayer" back={{ href: "/dashboard/prayer-board", label: "My prayer board" }} />
      <EditPrayerForm id={item.id} text={item.prayer_text} category={item.category ?? ""} />
    </div>
  );
}
