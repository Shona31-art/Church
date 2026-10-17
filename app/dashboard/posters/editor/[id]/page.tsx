import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, isShepherd } from "@/lib/permissions";
import { PosterDesignSchema } from "@/lib/posters/design";
import { PermissionDenied } from "@/components/ui/Gates";
import { Alert } from "@/components/ui/Alert";
import { EditorLoader } from "@/components/posters/editor/EditorLoader";

/**
 * Edit a saved poster design. Only its creator or a pastor/church admin may
 * edit (RLS enforces the same on save); anyone else is sent to the read-only
 * view. Old-style posters (no design) open their original edit form.
 */
export default async function EditPosterDesignPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "makePosters")) return <PermissionDenied message="Posters are made by pastors, church admins and department leaders." />;

  const { data: poster, error } = await createClient()
    .from("posters")
    .select("id, title, event_title, design, created_by, updated_at")
    .eq("id", params.id)
    .eq("church_id", me.church_id)
    .maybeSingle();
  if (error) console.error("[posters] load for editing failed:", error.message);
  if (!poster) notFound();
  if (!poster.design) redirect(`/dashboard/posters/${poster.id}/edit`);
  if (poster.created_by !== me.id && !isShepherd(me.role)) redirect(`/dashboard/posters/${poster.id}`);

  // Saved designs were validated on save; re-check in case the format moved on.
  const design = PosterDesignSchema.safeParse(poster.design);
  if (!design.success) {
    console.error("[posters] stored design failed validation:", poster.id, design.error.issues.slice(0, 3));
    return (
      <Alert tone="error" title="This poster can't be opened">
        Its saved design is in a format this version of the editor doesn&apos;t understand. Contact support and mention poster {poster.id}.
      </Alert>
    );
  }

  return (
    <EditorLoader
      initialDesign={design.data}
      initialTitle={poster.title ?? poster.event_title}
      posterId={poster.id}
      initialUpdatedAt={poster.updated_at}
    />
  );
}
