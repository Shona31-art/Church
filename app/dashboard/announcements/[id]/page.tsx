import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can, isShepherd } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { AnnouncementActions } from "./AnnouncementActions";

export default async function AnnouncementDetailPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("announcements");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  // RLS decides visibility (drafts/archived are author- and leader-only).
  const { data: a } = await createClient()
    .from("announcements")
    .select("id, title, body, pinned, status, created_at, updated_at, published_at, author_id, departments(name), author:app_users!announcements_author_id_fkey(name)")
    .eq("id", params.id)
    .eq("church_id", me.church_id)
    .maybeSingle();
  if (!a) notFound();

  const canManage = can(me.role, "postAnnouncements") && (a.author_id === me.id || isShepherd(me.role));
  const dept = (a as any).departments?.name as string | undefined;

  return (
    <article className="max-w-3xl">
      <PageHeader
        back={{ href: "/dashboard/announcements", label: "Announcements" }}
        title={a.title}
        meta={
          <>
            {a.status === "draft" && <StatusBadge tone="warning">Draft</StatusBadge>}
            {a.status === "archived" && <StatusBadge tone="neutral">Archived</StatusBadge>}
            {a.pinned && <StatusBadge tone="info">Pinned</StatusBadge>}
            <StatusBadge tone="neutral">{dept ? `${dept} only` : "Church-wide"}</StatusBadge>
          </>
        }
      />

      {a.status === "draft" && (
        <Alert tone="warning" className="mb-4">
          This is a preview. Members can&apos;t see it until it&apos;s published.
        </Alert>
      )}

      <div className="card-elevated rounded-2xl p-6">
        <p className="whitespace-pre-line leading-relaxed">{a.body}</p>
        <p className="text-xs text-ink/60 mt-6">
          {(a as any).author?.name ?? "Former member"} · {a.published_at ? `Published ${formatDateTime(a.published_at)}` : `Created ${formatDateTime(a.created_at)}`}
          {a.updated_at !== a.created_at ? ` · Edited ${formatDateTime(a.updated_at)}` : ""}
        </p>
      </div>

      {canManage && (
        <div className="mt-6">
          <AnnouncementActions id={a.id} title={a.title} status={a.status} />
        </div>
      )}
    </article>
  );
}
