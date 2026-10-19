import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate, formatRelative } from "@/lib/format";
import { isDirectMediaFile, isSafeHttpUrl, youtubeEmbedUrl } from "@/lib/media";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { DeleteNoteButton, NoteForm, SermonAdminActions } from "../SermonControls";
import { PrivacyNote } from "@/components/ui/PrivacyNote";

export default async function SermonDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("sermon_ai");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const [{ data: sermon }, { data: myNotes }] = await Promise.all([
    supabase.from("sermons").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle(),
    supabase.from("sermon_notes").select("id, note, created_at").eq("sermon_id", params.id).eq("user_id", me.id).order("created_at", { ascending: false }),
  ]);
  if (!sermon) notFound();

  const youtube = youtubeEmbedUrl(sermon.video_url);
  const video = !youtube && isDirectMediaFile(sermon.video_url) ? sermon.video_url : null;
  const otherVideoLink = !youtube && !video && isSafeHttpUrl(sermon.video_url) ? sermon.video_url : null;
  const audio = isSafeHttpUrl(sermon.audio_url) ? sermon.audio_url : null;
  const list = (items: string[] | null) => (items ?? []).filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/sermons", label: "Sermons" }}
        title={sermon.title}
        description={`${sermon.speaker ? `${sermon.speaker} · ` : ""}${formatDate(sermon.sermon_date)}`}
        actions={can(me.role, "manageSermons") ? <SermonAdminActions id={sermon.id} title={sermon.title} /> : null}
      />

      {youtube && (
        <div className="aspect-video overflow-hidden rounded-2xl bg-ink/5">
          <iframe
            src={youtube}
            title={`Video: ${sermon.title}`}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
      {video && <video controls preload="metadata" className="w-full rounded-2xl" src={video} />}
      {otherVideoLink && (
        <a href={otherVideoLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Watch the video ↗
        </a>
      )}
      {audio && (isDirectMediaFile(audio) ? <audio controls preload="metadata" className="w-full" src={audio} /> : (
        <a href={audio} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Listen ↗
        </a>
      ))}

      {sermon.ai_summary && (
        <Section title="Summary">
          <p className="text-sm leading-relaxed whitespace-pre-line">{sermon.ai_summary}</p>
        </Section>
      )}

      {(list(sermon.scripture_refs).length > 0 || list(sermon.discussion_questions).length > 0 || list(sermon.prayer_points).length > 0) && (
        <Section title="For small groups">
          {list(sermon.scripture_refs).length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-1">Scriptures</h3>
              <p className="text-sm">{list(sermon.scripture_refs).join(" · ")}</p>
            </div>
          )}
          {list(sermon.discussion_questions).length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-1">Discussion questions</h3>
              <ol className="list-decimal pl-5 text-sm space-y-1">
                {list(sermon.discussion_questions).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}
          {list(sermon.prayer_points).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Prayer points</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {list(sermon.prayer_points).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      <Section title="My notes" description={<PrivacyNote>Private — only you can see these.</PrivacyNote>}>
        <NoteForm sermonId={sermon.id} />
        {myNotes?.length ? (
          <ul className="mt-5 space-y-2">
            {myNotes.map((n) => (
              <li key={n.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="whitespace-pre-line">{n.note}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <time className="text-xs text-ink/50" dateTime={n.created_at}>
                    {formatRelative(n.created_at)}
                  </time>
                  <DeleteNoteButton noteId={n.id} sermonId={sermon.id} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-ink/60">You haven&apos;t written any notes on this sermon yet.</p>
        )}
      </Section>
    </div>
  );
}
