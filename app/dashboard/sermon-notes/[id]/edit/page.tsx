import { notFound } from "next/navigation";
import { z } from "zod";
import { moduleGate } from "@/lib/gate";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { todayInAppZone } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { OutlineForm } from "../../OutlineForms";

export const metadata = { title: "Edit sermon notes" };

export default async function EditSermonNotesPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("sermon_notes");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "manageSermons")) return <PermissionDenied message="Only pastors and church admins edit sermon notes." backHref="/dashboard/sermon-notes" />;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const { data } = await createClient().from("sermon_outlines").select("id, title, speaker, sermon_date, scripture, body, published").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!data) notFound();
  return (
    <div>
      <PageHeader back={{ href: `/dashboard/sermon-notes/${data.id}`, label: data.title }} title="Edit sermon notes" />
      <OutlineForm outline={data} today={todayInAppZone()} />
    </div>
  );
}
