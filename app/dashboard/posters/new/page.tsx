import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { PosterEditor } from "../PosterEditor";

export default async function NewPosterPage() {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "makePosters")) {
    return <PermissionDenied message="Only pastors, church admins and department leaders can create posters." backHref="/dashboard/posters" />;
  }

  // The preview uses the real church name — the same one the saved poster shows.
  const { data: church } = await createClient().from("churches").select("name").eq("id", me.church_id).maybeSingle();

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/posters", label: "Poster Studio" }}
        title="New poster"
        description="Pick a template and colour; the AI can suggest a tagline. The image is drawn in your browser."
      />
      <PosterEditor churchName={church?.name ?? ""} />
    </div>
  );
}
