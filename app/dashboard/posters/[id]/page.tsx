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
import { PosterDesignSchema, assetPaths } from "@/lib/posters/design";
import { signPosterAssets } from "@/lib/posters/assets";
import { PosterViewer } from "@/components/posters/editor/PosterViewer";
import { duplicatePosterAction } from "../editor-actions";

export default async function PosterDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const { data: poster } = await createClient().from("posters").select("*, churches(name)").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!poster) notFound();

  const canManage = can(me.role, "makePosters") && (poster.created_by === me.id || isShepherd(me.role));
  // Editor posters (Poster Studio v2) carry a design; older ones use the fixed layouts.
  const design = poster.design ? PosterDesignSchema.safeParse(poster.design) : null;
  const title = poster.title ?? poster.event_title;
  const imageUrls = design?.success ? await signPosterAssets(assetPaths(design.data), poster.church_id) : {};

  return (
    <div className={design ? "max-w-3xl" : "max-w-xl"}>
      <PageHeader
        back={{ href: "/dashboard/posters", label: "Poster Studio" }}
        title={title}
        actions={
          can(me.role, "makePosters") ? (
            <>
              <form action={duplicatePosterAction}>
                <input type="hidden" name="id" value={poster.id} />
                <button type="submit" className="btn-secondary">
                  Duplicate
                </button>
              </form>
              {canManage && (
              <>
              <Link href={design ? `/dashboard/posters/editor/${poster.id}` : `/dashboard/posters/${poster.id}/edit`} className="btn-secondary">
                Edit
              </Link>
              <DeletePosterButton id={poster.id} title={title} />
              </>
              )}
            </>
          ) : null
        }
      />
      {design ? (
        design.success ? (
          <PosterViewer design={design.data} title={title} imageUrls={imageUrls} />
        ) : (
          <p className="text-sm text-danger">This poster&apos;s design couldn&apos;t be read. Contact support and mention poster {poster.id}.</p>
        )
      ) : (
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
      )}
    </div>
  );
}
