import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { songAccess } from "../access";
import { deleteSong } from "../actions";
import { LyricsView } from "../SongForms";

export default async function SongPage({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const access = await songAccess();
  if (!access) return null;
  const { data: song } = await createClient().from("songs").select("id, title, author, song_key, lyrics").eq("id", params.id).eq("church_id", access.me.church_id).maybeSingle();
  if (!song) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        back={{ href: "/dashboard/songs", label: "Songs" }}
        title={song.title}
        description={[song.author && `By ${song.author}`, song.song_key && `Key of ${song.song_key}`].filter(Boolean).join(" · ") || undefined}
        actions={
          access.canManage ? (
            <>
              <Link href={`/dashboard/songs/${song.id}/edit`} className="btn-secondary">
                <Pencil aria-hidden className="h-4 w-4" /> Edit
              </Link>
              <form action={deleteSong}>
                <input type="hidden" name="id" value={song.id} />
                <ConfirmSubmitButton
                  title={`Delete “${song.title}”?`}
                  message="The song and its lyrics will be removed for everyone in your church. This can't be undone."
                  confirmLabel="Delete song"
                  pendingLabel="Deleting…"
                  className="btn-ghost text-danger"
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            </>
          ) : undefined
        }
      />
      <article className="card-elevated rounded-2xl p-5 sm:p-8">
        <LyricsView title={song.title} lyrics={song.lyrics} />
      </article>
    </div>
  );
}
