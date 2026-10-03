import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePosterStyle } from "@/lib/posters";
import { PosterPreview } from "../PosterCanvas";
import { moduleGate } from "@/lib/gate";

export default async function PosterDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;

  const supabase = createClient();
  const { data: poster } = await supabase.from("posters").select("*, churches(name)").eq("id", params.id).single();
  if (!poster) notFound();

  return (
    <div className="max-w-md">
      <Link href="/dashboard/posters" className="text-sm text-ink/50 hover:text-ink">← Posters</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-4">{poster.event_title}</h1>
      <PosterPreview
        data={{
          // The poster's own church, so it renders correctly for super admins too.
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
