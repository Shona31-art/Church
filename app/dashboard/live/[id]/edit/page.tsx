import { notFound } from "next/navigation";
import { z } from "zod";
import { moduleGate } from "@/lib/gate";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { utcIsoToLocalInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { LiveForm } from "../../LiveForm";
import { liveFormOptions } from "../../options";

export const metadata = { title: "Edit live service" };

export default async function EditLivePage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("live_sunday");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "planServices")) return <PermissionDenied message="Only pastors and church admins edit live services." backHref="/dashboard/live" />;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const { data: l } = await createClient().from("live_services").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!l) notFound();
  const options = await liveFormOptions(me.church_id!);
  return (
    <div>
      <PageHeader back={{ href: `/dashboard/live?id=${l.id}`, label: "Live Sunday" }} title="Edit live service" />
      <LiveForm live={{ ...l, starts_local: utcIsoToLocalInput(l.starts_at) }} defaults={{ title: l.title, starts_local: utcIsoToLocalInput(l.starts_at) }} {...options} />
    </div>
  );
}
