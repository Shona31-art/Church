import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { POSTER_SIZE_KEYS, type PosterSize } from "@/lib/posters/design";
import { POSTER_TEMPLATES, templateDesign } from "@/lib/posters/templates";
import { applyStyle, posterStyle } from "@/lib/posters/styles";
import { PermissionDenied } from "@/components/ui/Gates";
import { EditorLoader } from "@/components/posters/editor/EditorLoader";

/**
 * New poster in the editor: /dashboard/posters/editor/new?size=square&template=worship-night
 * (no template = blank). Nothing is saved until the person presses Save.
 */
export default async function NewPosterDesignPage({ searchParams }: { searchParams: { size?: string; template?: string; style?: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "makePosters")) return <PermissionDenied message="Posters are made by pastors, church admins and department leaders." />;

  const size: PosterSize = POSTER_SIZE_KEYS.includes(searchParams.size as PosterSize) ? (searchParams.size as PosterSize) : "square";
  const template = POSTER_TEMPLATES.find((t) => t.key === searchParams.template);
  const style = posterStyle(searchParams.style);

  return (
    <EditorLoader
      initialDesign={style ? applyStyle(templateDesign(template?.key, size), style.key) : templateDesign(template?.key, size)}
      initialTitle={template ? template.name : "Untitled poster"}
      posterId={null}
      initialUpdatedAt={null}
    />
  );
}
