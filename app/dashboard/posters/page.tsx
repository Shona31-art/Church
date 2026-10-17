import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { normalizePosterStyle } from "@/lib/posters";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { PosterPreview } from "./PosterCanvas";
import { NAV_ICONS } from "@/components/ui/NavIcon";
import Image from "next/image";
import { signPosterAssets } from "@/lib/posters/assets";

type PosterRow = {
  id: string;
  event_title: string;
  tagline: string | null;
  speaker: string | null;
  event_date: string | null;
  location: string | null;
  template_key: string | null;
  theme_color: string | null;
  format: string | null;
  created_at: string;
  title?: string | null;
  design_version?: number | null;
  width?: number | null;
  height?: number | null;
  thumbnail_path?: string | null;
};

export default async function PostersPage({ searchParams }: { searchParams: { page?: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "makePosters")) return <PermissionDenied message="Posters are made by pastors, church admins and department leaders." />;

  const page = pageFrom(searchParams.page);
  const supabase = createClient();
  const LEGACY_COLUMNS = "id, event_title, tagline, speaker, event_date, location, template_key, theme_color, format, created_at";
  const listPosters = (columns: string) =>
    supabase
      .from("posters")
      .select(columns)
      .eq("church_id", me.church_id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
      .returns<PosterRow[]>();
  const [first, { data: church }] = await Promise.all([
    listPosters(`${LEGACY_COLUMNS}, title, design_version, width, height, thumbnail_path`),
    supabase.from("churches").select("name").eq("id", me.church_id).maybeSingle(),
  ]);
  // Before migration #29 (poster_editor.sql) runs, the editor's columns don't
  // exist (Postgres error 42703). Keep listing the classic posters and say
  // what's needed, rather than failing the whole page.
  const needsMigration = first.error?.code === "42703";
  const { data, error } = needsMigration ? await listPosters(LEGACY_COLUMNS) : first;
  if (error) console.error("[posters] list failed:", error.message);
  if (needsMigration) console.error("[posters] poster_editor.sql (migration #29) hasn't been run; the new editor is unavailable.");

  const posters = (data ?? []).slice(0, PAGE_SIZE);
  // Preview images live in the private bucket: short-lived links, this church only.
  const thumbs = await signPosterAssets(posters.flatMap((p) => (p.thumbnail_path ? [p.thumbnail_path] : [])), me.church_id!);
  // "New design" opens the template gallery; "Quick poster" is the original fixed-layout maker.
  const newButton = (
    <>
      <Link href="/dashboard/posters/new" className="btn-ghost">
        Quick poster
      </Link>
      {!needsMigration && (
        <Link href="/dashboard/posters/new-design" className="btn-primary">
          New design
        </Link>
      )}
    </>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Poster Studio"
        description="Event posters from ready-made templates — designed in your browser, so they cost nothing to make. Download them for WhatsApp, Instagram or print."
        actions={newButton}
      />

      {needsMigration && (
        <Alert tone="info" title="The new poster editor needs a database update" className="mb-6">
          {can(me.role, "manageBilling")
            ? "Run supabase/poster_editor.sql (migration #29) in the Supabase SQL editor to switch on templates, photos and speakers. Your existing posters are safe."
            : "Ask your church admin to finish setting up the new poster editor. Your existing posters are safe."}
        </Alert>
      )}

      {error ? (
        <Alert tone="error">Couldn&apos;t load posters — refresh the page to try again.</Alert>
      ) : !posters.length ? (
        <EmptyState icon={NAV_ICONS.posters} title="No posters yet" description="Design a poster for your next event in a couple of minutes." action={newButton} />
      ) : (
        <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {posters.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/posters/${p.id}`} className="block card-interactive rounded-xl p-2">
                {p.design_version && p.thumbnail_path && thumbs[p.thumbnail_path] ? (
                  <Image
                    src={thumbs[p.thumbnail_path]}
                    alt=""
                    width={480}
                    height={Math.round((480 * (p.height ?? 1)) / (p.width ?? 1))}
                    unoptimized
                    className="w-full rounded-lg border border-line bg-surface-raised"
                  />
                ) : p.design_version ? (
                  // No preview yet (saved before previews existed, or the preview failed): show the name.
                  <div
                    className="flex items-center justify-center rounded-lg border border-line bg-surface-raised px-3 text-center"
                    style={{ aspectRatio: `${p.width ?? 1} / ${p.height ?? 1}` }}
                  >
                    <span className="font-display text-base font-semibold text-ink/70">{p.title ?? p.event_title}</span>
                  </div>
                ) : (
                <PosterPreview
                  showDownload={false}
                  data={{
                    churchName: church?.name ?? "",
                    eventTitle: p.event_title,
                    tagline: p.tagline ?? undefined,
                    speaker: p.speaker ?? undefined,
                    eventDate: p.event_date ?? undefined,
                    location: p.location ?? undefined,
                    ...normalizePosterStyle(p),
                  }}
                />
                )}
                <p className="mt-2 px-1 text-sm font-medium truncate">{p.title ?? p.event_title}</p>
                <p className="px-1 text-xs text-ink/60">Made {formatDate(p.created_at, { weekday: undefined })}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} hasMore={(data?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ page: p })} />
    </div>
  );
}
