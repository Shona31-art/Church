import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, isShepherd } from "@/lib/permissions";
import { normalizePosterStyle } from "@/lib/posters";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { PosterEditor } from "../../PosterEditor";

export default async function EditPosterPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const { data: poster } = await createClient().from("posters").select("*, churches(name)").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!poster) notFound();
  if (!can(me.role, "makePosters") || (poster.created_by !== me.id && !isShepherd(me.role))) {
    return <PermissionDenied message="Only the poster's creator, pastors and church admins can edit it." backHref={`/dashboard/posters/${poster.id}`} />;
  }

  return (
    <div>
      <PageHeader back={{ href: `/dashboard/posters/${poster.id}`, label: poster.event_title }} title="Edit poster" />
      <PosterEditor
        churchName={poster.churches?.name ?? ""}
        poster={{
          id: poster.id,
          eventTitle: poster.event_title,
          tagline: poster.tagline ?? "",
          speaker: poster.speaker ?? "",
          eventDate: poster.event_date ?? "",
          location: poster.location ?? "",
          ...normalizePosterStyle(poster),
        }}
      />
    </div>
  );
}
