import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { planIncludes } from "@/lib/features";
import { isPosterAiConfigured } from "@/lib/ai-image";
import { JIGSAW_BUCKET } from "@/lib/games/jigsaw";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { Alert } from "@/components/ui/Alert";
import { PictureManager, type PictureRow } from "./PictureManager";

// Painting a picture can take ~20 seconds; give the server action room.
export const maxDuration = 60;

export default async function JigsawPicturesPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "manageQuizQuestions")) return <PermissionDenied message="Pastors and church admins choose the jigsaw pictures." backHref="/dashboard/games" />;

  const { data, error } = await createClient().from("jigsaw_pictures").select("id, title, reference, storage_path, source").eq("church_id", me.church_id).order("created_at");
  const notSetUp = Boolean(error);
  const paths = (data ?? []).map((p) => p.storage_path);
  const { data: signed } = paths.length ? await createAdminClient().storage.from(JIGSAW_BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const pictures: PictureRow[] = (data ?? []).map((p) => ({ id: p.id, title: p.title, reference: p.reference, source: p.source, url: urlFor.get(p.storage_path) ?? null }));

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/dashboard/games", label: "Games" }}
        title="Jigsaw pictures"
        description="The pictures your church's Bible jigsaw uses. Paint them with AI or upload your own."
      />
      {notSetUp ? (
        <Alert tone="warning" title="Needs a database update">
          Run supabase/jigsaw_pictures.sql in the Supabase SQL Editor, then refresh this page.
        </Alert>
      ) : (
        <PictureManager pictures={pictures} aiAvailable={isPosterAiConfigured() && (await planIncludes("ai_assist"))} />
      )}
    </div>
  );
}
