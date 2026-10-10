import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, orFilterPattern, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NAV_ICONS } from "@/components/ui/NavIcon";

const TABS = [
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
] as const;

export default async function AnnouncementsPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string } }) {
  const gate = await moduleGate("announcements");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const canPost = can(me.role, "postAnnouncements");
  // Members only ever see published posts (RLS enforces it too).
  const status = canPost && ["draft", "archived"].includes(searchParams.status ?? "") ? searchParams.status! : "published";
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const page = pageFrom(searchParams.page);

  let query = createClient()
    .from("announcements")
    .select("id, title, body, pinned, status, created_at, published_at, department_id, departments(name), author:app_users!announcements_author_id_fkey(name)")
    .eq("church_id", me.church_id)
    .eq("status", status)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (q) query = query.or(`title.ilike.${orFilterPattern(q)},body.ilike.${orFilterPattern(q)}`);
  const { data, error } = await query;
  if (error) console.error("[announcements] list failed:", error.message);

  const items: any[] = (data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (data?.length ?? 0) > PAGE_SIZE;
  const newButton = canPost ? (
    <Link href="/dashboard/announcements/new" className="btn-primary">
      New announcement
    </Link>
  ) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Announcements" description="News and notices for your church family." actions={newButton} />

      {canPost && (
        <nav aria-label="Announcement status" className="mb-4 flex gap-1 border-b border-line">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={buildQuery({ status: t.key === "published" ? undefined : t.key, q })}
              aria-current={status === t.key ? "page" : undefined}
              className={`px-3 py-2 text-sm -mb-px border-b-2 ${status === t.key ? "border-ember font-semibold" : "border-transparent text-ink/60 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <FilterBar query={q} placeholder="Search announcements…" label="Search announcements" resetHref={buildQuery({ status: status === "published" ? undefined : status })} active={Boolean(q)}>
        {status !== "published" && <input type="hidden" name="status" value={status} />}
      </FilterBar>

      {error ? (
        <Alert tone="error" title="Couldn't load announcements">Refresh the page to try again.</Alert>
      ) : items.length === 0 ? (
        q ? (
          <EmptyState title="Nothing matches that search" description="Try different words, or clear the search." />
        ) : status === "draft" ? (
          <EmptyState title="No drafts" description="Save an announcement as a draft to finish it later." action={newButton} />
        ) : status === "archived" ? (
          <EmptyState title="No archived announcements" description="Archive old announcements to keep the list tidy without deleting them." />
        ) : (
          <EmptyState
            icon={NAV_ICONS.announcements}
            title="No announcements yet"
            description={canPost ? "Share your first piece of news with the church." : "When your church posts news, it will appear here."}
            action={newButton}
          />
        )
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/dashboard/announcements/${a.id}`} className="card-interactive rounded-2xl p-5 block">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {a.pinned && <StatusBadge tone="info">Pinned</StatusBadge>}
                  <StatusBadge tone="neutral">{a.departments?.name ? `${a.departments.name} only` : "Church-wide"}</StatusBadge>
                </div>
                <h2 className="font-semibold text-lg">{a.title}</h2>
                <p className="text-sm text-ink/70 mt-1 line-clamp-3 whitespace-pre-line">{a.body}</p>
                <p className="text-xs text-ink/50 mt-3">
                  {a.author?.name ?? "Former member"} · {formatDate(a.published_at ?? a.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} hasMore={hasMore} hrefFor={(p) => buildQuery({ status: status === "published" ? undefined : status, q, page: p })} />
    </div>
  );
}
