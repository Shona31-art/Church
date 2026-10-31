import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { songAccess } from "../access";
import { ImportForm } from "../SongForms";

export default async function ImportSongsPage() {
  const access = await songAccess();
  if (!access) return null;
  if (!access.canManage) return <PermissionDenied message="Only pastors, church admins and the worship team can import songs." backHref="/dashboard/songs" />;
  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/songs", label: "Songs" }}
        title="Import songs"
        description="Paste your song list (for example copied from EasyWorship) to add many songs at once."
      />
      <ImportForm />
    </div>
  );
}
