import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { TemplateGallery } from "@/components/posters/TemplateGallery";
import { OCCASIONS, type Occasion } from "@/lib/posters/templates";

/** Pick a size and a template to start a new poster in the editor. */
export default async function NewDesignPage({ searchParams }: { searchParams: { occasion?: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "makePosters")) return <PermissionDenied message="Posters are made by pastors, church admins and department leaders." />;

  return (
    <div className="max-w-6xl">
      <PageHeader
        back={{ href: "/dashboard/posters", label: "Poster Studio" }}
        title="New poster"
        description="Choose a size and a template. Everything on it can be changed: text, colours, photos and layout."
      />
      <TemplateGallery initialOccasion={(OCCASIONS as readonly string[]).includes(searchParams.occasion ?? "") ? (searchParams.occasion as Occasion) : "All"} />
    </div>
  );
}
