import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { songAccess } from "../access";
import { SongForm } from "../SongForms";

export default async function NewSongPage() {
  const access = await songAccess();
  if (!access) return null;
  if (!access.canManage) return <PermissionDenied message="Only pastors, church admins and the worship team can add songs." backHref="/dashboard/songs" />;
  return (
    <div>
      <PageHeader back={{ href: "/dashboard/songs", label: "Songs" }} title="Add a song" />
      <SongForm />
    </div>
  );
}
