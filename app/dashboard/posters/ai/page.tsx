import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { planIncludes } from "@/lib/features";
import { isPosterAiConfigured } from "@/lib/ai-image";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { Alert } from "@/components/ui/Alert";
import { AiPosterStudio } from "./AiPosterStudio";

// Drawing a poster can take up to ~30 seconds; give the server action room.
export const maxDuration = 60;

export default async function AiPosterPage() {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "makePosters")) return <PermissionDenied message="Posters are made by pastors, church admins and department leaders." backHref="/dashboard/posters" />;

  const [onPlan, { data: church }] = await Promise.all([
    planIncludes("ai_assist"),
    createClient().from("churches").select("logo_url").eq("id", me.church_id).maybeSingle(),
  ]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        back={{ href: "/dashboard/posters", label: "Poster Studio" }}
        title="Create a poster with AI"
        description="Describe it, add photos if you like, and the AI designs the whole poster. Then ask for changes until it's just right."
      />
      {!onPlan ? (
        <Alert tone="info" title="AI posters are part of Premium">
          Your church&apos;s plan doesn&apos;t include AI help. You can still make posters from templates in Poster Studio.
        </Alert>
      ) : !isPosterAiConfigured() ? (
        <Alert tone="warning" title="AI posters aren't switched on yet">
          They need a Google Gemini API key (GEMINI_API_KEY) with billing turned on. Ask your platform admin.
        </Alert>
      ) : (
        <AiPosterStudio hasLogo={Boolean(church?.logo_url)} />
      )}
    </div>
  );
}
