import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, isShepherd } from "@/lib/permissions";
import { aiAssistAvailable } from "@/lib/features";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { AnnouncementForm } from "../../AnnouncementForm";

export default async function EditAnnouncementPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("announcements");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const [{ data: a }, { data: departments }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, department_id, pinned, status, updated_at, author_id")
      .eq("id", params.id)
      .eq("church_id", me.church_id)
      .maybeSingle(),
    supabase.from("departments").select("id, name").eq("church_id", me.church_id).order("name"),
  ]);
  if (!a) notFound();

  if (!can(me.role, "postAnnouncements") || (a.author_id !== me.id && !isShepherd(me.role))) {
    return <PermissionDenied message="You can only edit announcements you wrote." backHref={`/dashboard/announcements/${a.id}`} />;
  }

  return (
    <div>
      <PageHeader back={{ href: `/dashboard/announcements/${a.id}`, label: a.title }} title="Edit announcement" />
      <AnnouncementForm
        departments={departments ?? []}
        canPostChurchWide={can(me.role, "postChurchWide")}
        aiAvailable={await aiAssistAvailable()}
        announcement={a}
      />
    </div>
  );
}
