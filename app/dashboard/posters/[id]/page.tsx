import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, isShepherd } from "@/lib/permissions";
import { normalizePosterStyle } from "@/lib/posters";
import { PageHeader } from "@/components/ui/PageHeader";
import { PosterPreview } from "../PosterCanvas";
import { DeletePosterButton } from "../DeletePosterButton";

export default async function PosterDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const { data: poster } = await createClient().from("posters").select("*, churches(name)").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!poster) notFound();

  const canManage = can(me.role, "makePosters") && (poster.created_by === me.id || isShepherd(me.role));

  return (
    <div className="max-w-xl">
      <PageHeader
        back={{ href: "/dashboard/posters", label: "Poster Studio" }}
        title={poster.event_title}
        actions={
          canManage ? (
            <>
              <Link href={`/dashboard/posters/${poster.id}/edit`} className="btn-secondary">
                Edit
              </Link>
              <DeletePosterButton id={poster.id} title={poster.event_title} />
            </>
          ) : null
        }
      />
      <PosterPreview
        data={{
          churchName: poster.churches?.name ?? "",
          eventTitle: poster.event_title,
          tagline: poster.tagline ?? undefined,
          speaker: poster.speaker ?? undefined,
          eventDate: poster.event_date ?? undefined,
          location: poster.location ?? undefined,
          ...normalizePosterStyle(poster),
        }}
      />
    </div>
  );
}
