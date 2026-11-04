import Link from "next/link";
import { Sparkle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { TestimonyForm } from "./TestimonyForm";
import { deleteTestimony, reviewTestimony } from "./actions";

export const metadata = { title: "Testimonies" };

type Row = { id: string; title: string | null; body: string; show_name: boolean; status: string; created_at: string; user_id: string; author: { name: string } | null };

export default async function TestimoniesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const gate = await moduleGate("testimonies");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const shepherd = can(me.role, "moderatePrayerWall");
  const { data, error } = await createClient()
    .from("testimonies")
    .select("id, title, body, show_name, status, created_at, user_id, author:app_users!testimonies_user_id_fkey(name)")
    .eq("church_id", me.church_id)
    .order("created_at", { ascending: false })
    .limit(300);
  const all = (data ?? []) as unknown as Row[];
  const waiting = all.filter((t) => t.status === "pending");
  const mine = all.filter((t) => t.user_id === me.id && t.status !== "approved");
  const tab = searchParams.tab === "review" && shepherd ? "review" : searchParams.tab === "mine" ? "mine" : "wall";
  const shown = tab === "review" ? waiting : tab === "mine" ? mine : all.filter((t) => t.status === "approved");

  const tabs = [
    { key: "wall", label: "Wall", href: "/dashboard/testimonies" },
    ...(mine.length ? [{ key: "mine", label: `Mine, waiting (${mine.length})`, href: "/dashboard/testimonies?tab=mine" }] : []),
    ...(shepherd ? [{ key: "review", label: `Waiting for approval (${waiting.length})`, href: "/dashboard/testimonies?tab=review" }] : []),
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader back={{ href: "/dashboard", label: "Home" }} title="Testimonies" description="What God is doing in our church family. A pastor approves each one before it's shown." />
      <TestimonyForm />
      {error && <Alert tone="error">Testimonies need a database update (church_life.sql) — ask your church admin.</Alert>}

      {tabs.length > 1 && (
        <nav aria-label="Testimonies" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={tab === t.key ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t.key ? "bg-ember text-on-ember" : "border border-line text-ink/70"}`}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      {!shown.length ? (
        <EmptyState icon={Sparkle} title={tab === "review" ? "Nothing waiting" : tab === "mine" ? "Nothing waiting" : "No testimonies yet"} description={tab === "wall" ? "Be the first to share what God has done." : undefined} />
      ) : (
        <ul className="space-y-4">
          {shown.map((t) => (
            <li key={t.id} className="card-elevated rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {t.title && <h2 className="font-display text-xl">{t.title}</h2>}
                  <p className="text-xs text-ink/60">
                    {t.show_name || tab !== "wall" ? t.author?.name ?? "Former member" : "A church member"}
                    {!t.show_name && tab !== "wall" ? " (shown as “A church member”)" : ""} · {formatDate(t.created_at)}
                  </p>
                </div>
                {t.status !== "approved" && <StatusBadge tone={t.status === "pending" ? "warning" : "neutral"}>{t.status === "pending" ? "Waiting for approval" : "Not approved"}</StatusBadge>}
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{t.body}</p>
              {(shepherd || t.user_id === me.id) && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  {shepherd && t.status === "pending" && (
                    <>
                      <form action={reviewTestimony}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <PendingButton className="btn-primary btn-sm" pendingLabel="Approving…">Approve</PendingButton>
                      </form>
                      <form action={reviewTestimony}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="decision" value="declined" />
                        <PendingButton className="btn-secondary btn-sm" pendingLabel="Saving…">Decline</PendingButton>
                      </form>
                    </>
                  )}
                  <form action={deleteTestimony} className="ml-auto">
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmSubmitButton className="btn-ghost btn-sm" title="Remove this testimony?" message="It will be removed for good." confirmLabel="Remove" pendingLabel="Removing…">
                      Remove
                    </ConfirmSubmitButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
