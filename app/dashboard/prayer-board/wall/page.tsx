import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { togglePrayed, deletePrayerComment, removeFromWall } from "../actions";
import { CommentForm } from "./CommentForm";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { moduleGate } from "@/lib/gate";

// Church prayer wall (ported from the Android Prayer Board): requests members
// chose to share, plus answered-prayer testimonies. Private prayers never
// appear here — RLS only returns shared items (church_os_features_schema.sql).

const PAGE_SIZE = 30;

export default async function PrayerWallPage({ searchParams }: { searchParams: { page?: string } }) {
  const gate = await moduleGate("prayer_board");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  const supabase = createClient();
  const page = Math.max(0, Number(searchParams.page) || 0);

  const { data: prayers, error } = await supabase
    .from("prayer_board_items")
    .select(
      "id, user_id, prayer_text, category, scripture_refs, status, answered_reflection, created_at, answered_at, app_users(name)"
    )
    .eq("church_id", me!.church_id)
    .or("is_shared_request.eq.true,is_testimony_shared.eq.true")
    .order("created_at", { ascending: false })
    // One extra row tells us whether there's a next page.
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const hasMore = (prayers?.length ?? 0) > PAGE_SIZE;
  const visible: any[] = (prayers ?? []).slice(0, PAGE_SIZE);
  const ids = visible.map((p) => p.id);

  let comments: any[] = [];
  let intercessions: any[] = [];
  if (ids.length) {
    const [commentsRes, prayedRes] = await Promise.all([
      supabase
        .from("prayer_comments")
        .select("id, prayer_id, user_id, body, created_at, app_users(name)")
        .in("prayer_id", ids)
        .order("created_at"),
      supabase.from("prayer_intercessions").select("prayer_id, user_id").in("prayer_id", ids),
    ]);
    comments = commentsRes.data ?? [];
    intercessions = prayedRes.data ?? [];
  }

  const isShepherd = ["pastor", "church_admin"].includes(me!.role);

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-semibold">Church prayer wall</h1>
        <Link href="/dashboard/prayer-board/new" className="btn-primary">
          + Share a request
        </Link>
      </div>
      <p className="text-sm text-ink/50 mb-6">
        Requests and testimonies your church family chose to share. Your own board stays private unless you share.
      </p>

      {error && (
        <p role="alert" className="text-sm text-danger bg-danger-tint border border-danger-line rounded-lg p-3 mb-6">
          ⚠ Couldn&apos;t load the prayer wall — refresh to try again.
        </p>
      )}
      {!error && visible.length === 0 && (
        <div className="card-elevated rounded-2xl p-6 text-center">
          <p className="text-ink/60">No shared prayers yet.</p>
          <p className="text-sm text-ink/40 mt-1">
            Share a request from your{" "}
            <Link href="/dashboard/prayer-board" className="text-ember">
              prayer board
            </Link>{" "}
            so others can pray with you.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {visible.map((p) => {
          const prayedBy = intercessions.filter((i) => i.prayer_id === p.id);
          const iPrayed = prayedBy.some((i) => i.user_id === me!.id);
          const thread = comments.filter((c) => c.prayer_id === p.id);
          const isTestimony = p.status === "answered";

          return (
            <article key={p.id} className="card-elevated rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>
                  <span className="font-semibold text-ink">{p.app_users?.name ?? "A member"}</span>
                  {p.category ? ` · ${p.category}` : ""}
                </span>
                <span className={isTestimony ? "text-success font-semibold" : ""}>
                  {isTestimony ? "⭐ Answered prayer" : new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line">{p.prayer_text}</p>
              {p.scripture_refs?.length > 0 && <p className="text-sm text-ember mt-2">{p.scripture_refs.join(" · ")}</p>}
              {isTestimony && p.answered_reflection && (
                <p className="text-sm text-ink/70 border-l-2 border-gold pl-3 mt-3">{p.answered_reflection}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-4">
                {!isTestimony && (
                  <form action={togglePrayed}>
                    <input type="hidden" name="id" value={p.id} />
                    <PendingButton
                      className={`text-sm rounded-lg px-3 py-1.5 border ${
                        iPrayed ? "bg-ember text-on-ember border-ember" : "border-ink/20 hover:bg-ink/5"
                      }`}
                      pendingLabel="…"
                    >
                      🙏 {iPrayed ? "You prayed" : "I prayed"}
                    </PendingButton>
                  </form>
                )}
                <span className="text-xs text-ink/50">
                  {prayedBy.length} {prayedBy.length === 1 ? "person has" : "people have"} prayed
                  {thread.length ? ` · ${thread.length} ${thread.length === 1 ? "message" : "messages"}` : ""}
                </span>
                {isShepherd && p.user_id !== me!.id && (
                  <form action={removeFromWall} className="ml-auto">
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmSubmitButton
                      title="Remove this request from the prayer wall?"
                      message="Only sharing is turned off — it stays on the member's private board, untouched. The removal is noted in the audit log."
                      confirmLabel="Remove from wall"
                      className="btn-ghost btn-sm"
                    >
                      Remove from wall
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>

              {thread.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-ink/10 pt-3">
                  {thread.map((c) => (
                    <li key={c.id} className="text-sm flex items-start justify-between gap-3">
                      <p>
                        <span className="font-semibold">{c.app_users?.name ?? "Member"}:</span> {c.body}
                      </p>
                      {(c.user_id === me!.id || isShepherd) && (
                        <form action={deletePrayerComment}>
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmSubmitButton
                            title="Delete this message?"
                            message="The encouragement message will be permanently removed from the prayer wall."
                            confirmLabel="Delete message"
                            className="btn-ghost btn-sm shrink-0"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <CommentForm prayerId={p.id} />
            </article>
          );
        })}
      </div>

      {(page > 0 || hasMore) && (
        <nav className="flex justify-between mt-6 text-sm" aria-label="Pagination">
          {page > 0 ? (
            <Link href={`?page=${page - 1}`} className="text-ember">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={`?page=${page + 1}`} className="text-ember">
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
