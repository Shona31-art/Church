import Link from "next/link";
import { ExternalLink, ListOrdered, Music, Pencil, Plus, Radio } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { isSafeHttpUrl, mediaEmbed } from "@/lib/media";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MediaEmbedFrame } from "@/components/ui/MediaEmbedFrame";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FillInNotes } from "../sermon-notes/OutlineForms";
import { deleteLiveService } from "./actions";

export const metadata = { title: "Live Sunday" };

const LIVE_HOURS = 3;

export default async function LivePage({ searchParams }: { searchParams: { id?: string } }) {
  const gate = await moduleGate("live_sunday");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const manage = can(me.role, "planServices");
  const supabase = createClient();
  const now = Date.now();

  const { data: list } = await supabase.from("live_services").select("id, title, starts_at").eq("church_id", me.church_id).order("starts_at", { ascending: false }).limit(30);
  const services = list ?? [];
  // The one asked for; otherwise the soonest one that hasn't finished; otherwise the latest.
  const wanted = z.string().uuid().safeParse(searchParams.id).success ? services.find((s) => s.id === searchParams.id) : undefined;
  const current =
    wanted ??
    [...services].reverse().find((s) => new Date(s.starts_at).getTime() + LIVE_HOURS * 3_600_000 > now) ??
    services[0];

  if (!current) {
    return (
      <div className="max-w-3xl">
        <PageHeader back={{ href: "/dashboard", label: "Home" }} title="Live Sunday" description="Watch the service live, with the order of service and song words." />
        <EmptyState
          icon={Radio}
          title="No live service yet"
          description={manage ? "Add this Sunday's livestream link, order of service and songs." : "When your church streams a service, it will be here."}
          action={
            manage ? (
              <Link href="/dashboard/live/new" className="btn-primary">
                <Plus aria-hidden className="h-4 w-4" /> Set up a live service
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const { data: live } = await supabase.from("live_services").select("*").eq("id", current.id).single();
  const songIds: string[] = live?.song_ids ?? [];
  const [{ data: items }, { data: songRows }, { data: outline }] = await Promise.all([
    live?.service_plan_id
      ? supabase.from("service_plan_items").select("id, item_title, duration_minutes, notes, order_index").eq("service_plan_id", live.service_plan_id).order("order_index")
      : Promise.resolve({ data: [] as any[] }),
    songIds.length ? supabase.from("songs").select("id, title, author, lyrics").in("id", songIds) : Promise.resolve({ data: [] as any[] }),
    live?.outline_id ? supabase.from("sermon_outlines").select("id, title, body, scripture").eq("id", live.outline_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const songs = songIds.map((id) => (songRows ?? []).find((s: any) => s.id === id)).filter(Boolean) as { id: string; title: string; author: string | null; lyrics: string }[];
  const start = new Date(live.starts_at).getTime();
  const status = now < start ? "soon" : now < start + LIVE_HOURS * 3_600_000 ? "live" : "past";
  const embed = mediaEmbed(live.stream_url);
  const journal = (await checkModuleAccess("journal")).allowed;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title={live.title}
        description={formatDateTime(live.starts_at)}
        actions={
          manage ? (
            <>
              <Link href={`/dashboard/live/${live.id}/edit`} className="btn-secondary">
                <Pencil aria-hidden className="h-4 w-4" /> Edit
              </Link>
              <Link href="/dashboard/live/new" className="btn-primary">
                <Plus aria-hidden className="h-4 w-4" /> New
              </Link>
            </>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {status === "live" && <StatusBadge tone="danger">🔴 Live now</StatusBadge>}
        {status === "soon" && <StatusBadge tone="info">Starts {formatDateTime(live.starts_at)}</StatusBadge>}
        {status === "past" && <StatusBadge tone="neutral">Watch again</StatusBadge>}
      </div>

      {embed ? (
        <MediaEmbedFrame embed={embed} title={live.title} />
      ) : (
        isSafeHttpUrl(live.stream_url) && (
          <a href={live.stream_url} target="_blank" rel="noopener noreferrer" className="btn-primary w-full justify-center py-4 text-base">
            <ExternalLink aria-hidden className="h-5 w-5" /> Watch the livestream
          </a>
        )
      )}
      {live.message && <p className="rounded-xl bg-gold/10 p-4 text-sm whitespace-pre-line">{live.message}</p>}

      {(items ?? []).length > 0 && (
        <Section title="Order of service">
          <ol className="space-y-2">
            {(items ?? []).map((it: any, i: number) => (
              <li key={it.id} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/5 text-xs font-semibold">{i + 1}</span>
                <div>
                  <p className="font-medium">
                    {it.item_title}
                    {it.duration_minutes ? <span className="font-normal text-ink/50"> · {it.duration_minutes} min</span> : null}
                  </p>
                  {it.notes && <p className="text-ink/60">{it.notes}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {songs.length > 0 && (
        <section aria-labelledby="songs-h" className="space-y-2">
          <h2 id="songs-h" className="flex items-center gap-2 text-lg font-semibold">
            <Music aria-hidden className="h-5 w-5 text-gold" /> Songs
          </h2>
          {songs.map((s, i) => (
            <details key={s.id} className="card-elevated rounded-2xl p-4" open={i === 0}>
              <summary className="cursor-pointer font-semibold">
                {i + 1}. {s.title}
                {s.author ? <span className="font-normal text-ink/50"> · {s.author}</span> : null}
              </summary>
              <p className="mt-3 whitespace-pre-line text-[17px] leading-relaxed">{s.lyrics || "No words added yet."}</p>
            </details>
          ))}
        </section>
      )}

      {outline && (
        <section aria-labelledby="notes-h" className="space-y-3">
          <h2 id="notes-h" className="flex items-center gap-2 text-lg font-semibold">
            <ListOrdered aria-hidden className="h-5 w-5 text-gold" /> Sermon notes: {outline.title}
          </h2>
          <FillInNotes id={outline.id} body={outline.body} journal={journal} />
        </section>
      )}

      {services.length > 1 && (
        <Section title="Other services">
          <ul className="divide-y divide-line text-sm">
            {services
              .filter((s) => s.id !== live.id)
              .slice(0, 10)
              .map((s) => (
                <li key={s.id} className="py-2">
                  <Link href={`/dashboard/live?id=${s.id}`} className="link">
                    {s.title}
                  </Link>{" "}
                  <span className="text-ink/50">· {formatDateTime(s.starts_at)}</span>
                </li>
              ))}
          </ul>
        </Section>
      )}

      {manage && (
        <form action={deleteLiveService} className="flex justify-end">
          <input type="hidden" name="id" value={live.id} />
          <ConfirmSubmitButton title="Delete this live service?" message="The link, songs and notes stay where they are; only this live page is removed." confirmLabel="Delete" pendingLabel="Deleting…">
            Delete
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
