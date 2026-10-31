import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { songAccess } from "../../access";
import { SongForm } from "../../SongForms";

export default async function EditSongPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const access = await songAccess();
  if (!access) return null;
  if (!access.canManage) return <PermissionDenied message="Only pastors, church admins and the worship team can edit songs." backHref={`/dashboard/songs/${params.id}`} />;
  const { data: song } = await createClient().from("songs").select("id, title, author, song_key, lyrics").eq("id", params.id).eq("church_id", access.me.church_id).maybeSingle();
  if (!song) notFound();
  return (
    <div>
      <PageHeader back={{ href: `/dashboard/songs/${song.id}`, label: song.title }} title="Edit song" />
      <SongForm song={song} />
    </div>
  );
}
