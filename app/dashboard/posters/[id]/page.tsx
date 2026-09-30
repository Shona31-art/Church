import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { PosterPreview } from "../PosterCanvas";

export default async function PosterDetailPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("ai_poster");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: poster } = await supabase.from("posters").select("*").eq("id", params.id).single();
  if (!poster) notFound();

  const { data: church } = await supabase
    .from("churches")
    .select("name")
    .eq("id", me!.church_id)
    .single();

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-4">{poster.event_title}</h1>
      <PosterPreview
        data={{
          churchName: church?.name || "",
          eventTitle: poster.event_title,
          tagline: poster.tagline,
          speaker: poster.speaker,
          eventDate: poster.event_date,
          location: poster.location,
          templateKey: poster.template_key,
          themeColor: poster.theme_color,
          format: poster.format,
        }}
      />
    </div>
  );
}
