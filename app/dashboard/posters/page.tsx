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

export default async function PostersPage({ searchParams }: { searchParams: { page?: string } }) {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "makePosters")) return <PermissionDenied message="Posters are made by pastors, church admins and department leaders." />;

  const page = pageFrom(searchParams.page);
  const supabase = createClient();
  const [{ data, error }, { data: church }] = await Promise.all([
    supabase
      .from("posters")
      .select("id, title, event_title, tagline, speaker, event_date, location, template_key, theme_color, format, design_version, width, height, created_at")
      .eq("church_id", me.church_id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    supabase.from("churches").select("name").eq("id", me.church_id).maybeSingle(),
  ]);
  if (error) console.error("[posters] list failed:", error.message);

  const posters = (data ?? []).slice(0, PAGE_SIZE);
  // Until the template gallery (plan step 3), "New design" opens the sample template.
  const newButton = (
    <>
      <Link href="/dashboard/posters/new" className="btn-ghost">
        Quick poster
      </Link>
      <Link href="/dashboard/posters/editor/new?template=worship-night" className="btn-primary">
        New design
      </Link>
    </>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Poster Studio"
        description="Event posters from ready-made templates — designed in your browser, so they cost nothing to make. Download them for WhatsApp, Instagram or print."
        actions={newButton}
      />

      {error ? (
        <Alert tone="error">Couldn&apos;t load posters — refresh the page to try again.</Alert>
      ) : !posters.length ? (
        <EmptyState icon={NAV_ICONS.posters} title="No posters yet" description="Design a poster for your next event in a couple of minutes." action={newButton} />
      ) : (
        <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {posters.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/posters/${p.id}`} className="block card-interactive rounded-xl p-2">
                {p.design_version ? (
                  // Editor designs: a real preview image arrives with list thumbnails (plan step 5).
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
