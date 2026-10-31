import Link from "next/link";
import { BackLink } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { togglePrayed, deletePrayerComment, removeFromWall } from "../actions";
import { CommentForm } from "./CommentForm";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { moduleGate } from "@/lib/gate";
import { Alert } from "@/components/ui/Alert";
import { BookOpen, Flame, HandHeart, MessageCircle, Plus, Sparkles } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { buildQuery, pageFrom } from "@/lib/list";
import { formatDate } from "@/lib/format";
import { PRAYER_THEMES, PrayerArt, PrayerWallBanner, prayerTheme } from "@/components/prayer/PrayerArt";

// Church prayer wall (ported from the Android Prayer Board): requests members
// chose to share, plus answered-prayer testimonies. Private prayers never
// appear here — RLS only returns shared items (church_os_features_schema.sql).

const PAGE_SIZE = 30;
const SHOW = ["all", "requests", "answered"] as const;
type Show = (typeof SHOW)[number];
const CATEGORIES = ["family", "health", "career", "ministry", "personal"] as const;

function initials(name: string | null | undefined) {
  const parts = (name ?? "Member").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "M") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** A stable small number from an id, so each card's stars sit in their own places. */
function seedFrom(id: string) {
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) % 997;
  return n;
}

export default async function PrayerWallPage({ searchParams }: { searchParams: { page?: string; show?: string; category?: string } }) {
  const gate = await moduleGate("prayer_board");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const page = pageFrom(searchParams.page);
  const show: Show = (SHOW as readonly string[]).includes(searchParams.show ?? "") ? (searchParams.show as Show) : "all";
  const category = (CATEGORIES as readonly string[]).includes(searchParams.category ?? "") ? searchParams.category! : "";
  const href = (params: { show?: Show; category?: string; page?: number }) =>
    `/dashboard/prayer-board/wall${buildQuery({
      show: (params.show ?? show) === "all" ? undefined : params.show ?? show,
      category: params.category === undefined ? category : params.category,
      page: params.page,
    })}`.replace(/\?$/, "");

  let query = supabase
    .from("prayer_board_items")
    .select("id, user_id, prayer_text, category, scripture_refs, status, answered_reflection, created_at, answered_at, app_users(name)")
    .eq("church_id", me.church_id)
    .or("is_shared_request.eq.true,is_testimony_shared.eq.true");
  if (show === "requests") query = query.neq("status", "answered");
  if (show === "answered") query = query.eq("status", "answered");
  if (category) query = query.eq("category", category);

  const shared = () =>
    supabase
      .from("prayer_board_items")
      .select("id", { count: "exact", head: true })
      .eq("church_id", me.church_id)
      .or("is_shared_request.eq.true,is_testimony_shared.eq.true");

  const [{ data: prayers, error }, requestCount, answeredCount] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      // One extra row tells us whether there's a next page.
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    shared().neq("status", "answered"),
    shared().eq("status", "answered"),
  ]);

  const hasMore = (prayers?.length ?? 0) > PAGE_SIZE;
  const visible: any[] = (prayers ?? []).slice(0, PAGE_SIZE);
  const ids = visible.map((p) => p.id);

  let comments: any[] = [];
  let intercessions: any[] = [];
  if (ids.length) {
    const [commentsRes, prayedRes] = await Promise.all([
      supabase.from("prayer_comments").select("id, prayer_id, user_id, body, created_at, app_users(name)").in("prayer_id", ids).order("created_at"),
      supabase.from("prayer_intercessions").select("prayer_id, user_id").in("prayer_id", ids),
    ]);
    comments = commentsRes.data ?? [];
    intercessions = prayedRes.data ?? [];
  }

  const isShepherd = ["pastor", "church_admin"].includes(me.role);
  const filtered = show !== "all" || category !== "";

  return (
    <div className="max-w-5xl">
      <BackLink href="/dashboard/prayer-board" label="My prayer board" />

      {/* Banner: candles beneath a glowing cross. */}
      <section className="scope-dark relative isolate mb-6 overflow-hidden rounded-3xl shadow-[0_20px_60px_-20px_rgba(5,10,28,0.8)]">
        <PrayerWallBanner className="absolute inset-0 -z-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#050a1c]/90 via-[#050a1c]/30 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#050a1c]/75 via-[#050a1c]/20 to-transparent sm:from-[#050a1c]/40" />
        <div className="flex min-h-[15rem] flex-col justify-end gap-4 p-5 sm:min-h-[17rem] sm:p-8">
          <div>
            <p className="text-eyebrow font-semibold uppercase tracking-[0.35em] text-[#f5c86a]">Your church family</p>
            <h1 className="mt-1 bg-gradient-to-r from-[#fff8e1] via-[#f8d488] to-[#f0b04a] bg-clip-text pb-1 font-script text-5xl leading-tight text-transparent sm:text-6xl">
              Prayer Wall
            </h1>
            <p className="max-w-md text-sm text-ink/80">“Carry each other’s burdens.” — Galatians 6:2. Requests and answered prayers your church chose to share.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Flame aria-hidden className="h-3.5 w-3.5 text-[#f5c86a]" /> <span className="tabular">{requestCount.count ?? 0}</span> open requests
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles aria-hidden className="h-3.5 w-3.5 text-[#f5c86a]" /> <span className="tabular">{answeredCount.count ?? 0}</span> answered
            </span>
            <Link href="/dashboard/prayer-board/new" className="btn btn-amber btn-sm ml-auto">
              <Plus aria-hidden className="h-4 w-4" /> Share a request
            </Link>
          </div>
        </div>
      </section>

      {/* Filters */}
      <nav aria-label="Filter the prayer wall" className="mb-6 space-y-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {SHOW.map((s) => (
            <Link
              key={s}
              href={href({ show: s, page: 0 })}
              aria-current={show === s ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${show === s ? "bg-ember text-on-ember shadow" : "text-ink/70 hover:text-ink"}`}
            >
              {s === "all" ? "All" : s === "requests" ? "Requests" : "Answered"}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <Link
            href={href({ category: "", page: 0 })}
            aria-current={!category ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${!category ? "border-ember bg-ember/10 text-ember" : "border-line text-ink/70"}`}
          >
            Every category
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={href({ category: c, page: 0 })}
              aria-current={category === c ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${category === c ? "border-ember bg-ember/10 text-ember" : "border-line text-ink/70"}`}
            >
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: PRAYER_THEMES[c].sky[2] }} />
              {PRAYER_THEMES[c].label}
            </Link>
          ))}
        </div>
      </nav>

      {error && (
        <Alert tone="error" className="mb-6">
          Couldn&apos;t load the prayer wall — refresh to try again.
        </Alert>
      )}
      {!error && visible.length === 0 && (
        <div className="card-elevated overflow-hidden rounded-3xl text-center">
          <div className="h-28">
            <PrayerArt theme="general" />
          </div>
          <div className="p-6">
            <p className="font-display text-xl">{filtered ? "Nothing here yet" : "The wall is quiet"}</p>
            <p className="mt-1 text-sm text-ink/60">
              {filtered ? (
                <>
                  No prayers match this filter.{" "}
                  <Link href="/dashboard/prayer-board/wall" className="text-ember">
                    Show everything
                  </Link>
                </>
              ) : (
                <>
                  Share a request from your{" "}
                  <Link href="/dashboard/prayer-board" className="text-ember">
                    prayer board
                  </Link>{" "}
                  so others can pray with you.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="gap-5 md:columns-2">
        {visible.map((p) => {
          const prayedBy = intercessions.filter((i) => i.prayer_id === p.id);
          const iPrayed = prayedBy.some((i) => i.user_id === me.id);
          const thread = comments.filter((c) => c.prayer_id === p.id);
          const isTestimony = p.status === "answered";
          const theme = prayerTheme(p.category, isTestimony);
          const name = p.app_users?.name ?? "A member";
          const mine = p.user_id === me.id;

          return (
            <article
              key={p.id}
              className={`card-elevated mb-5 break-inside-avoid overflow-hidden rounded-3xl ${isTestimony ? "ring-2 ring-[#f0b04a]/60 shadow-[0_10px_40px_-12px_rgba(240,176,74,0.55)]" : ""}`}
            >
              <div className="relative h-28">
                <PrayerArt theme={theme} seed={seedFrom(p.id)} />
                <span
                  className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur ${
                    isTestimony ? "bg-[#fff3c4]/95 text-[#6b3f0a]" : "bg-black/35 text-white"
                  }`}
                >
                  {isTestimony && <Sparkles aria-hidden className="h-3 w-3" />}
                  {isTestimony ? "Answered prayer" : PRAYER_THEMES[theme].label}
                </span>
                {mine && <span className="absolute right-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">Yours</span>}
              </div>

              <div className="relative px-5 pb-5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="-mt-6 grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 border-surface text-sm font-bold text-white shadow"
                    style={{ background: `linear-gradient(135deg, ${PRAYER_THEMES[theme].sky[1]}, ${PRAYER_THEMES[theme].sky[0]})` }}
                  >
                    {initials(p.app_users?.name)}
                  </span>
                  <p className="pt-2 text-xs text-ink/60">
                    <span className="block text-sm font-semibold text-ink">{name}</span>
                    {isTestimony && p.answered_at ? `Answered ${formatDate(p.answered_at)}` : formatDate(p.created_at)}
                  </p>
                </div>

                <p className="mt-4 whitespace-pre-line font-display text-lg leading-snug">{p.prayer_text}</p>

                {p.scripture_refs?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.scripture_refs.map((ref: string) => (
                      <span key={ref} className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold-deep">
                        <BookOpen aria-hidden className="h-3 w-3" /> {ref}
                      </span>
                    ))}
                  </div>
                )}

                {isTestimony && p.answered_reflection && (
                  <div className="mt-4 rounded-2xl border border-[#f0b04a]/40 bg-[#f0b04a]/10 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#b9771f]">How God answered</p>
                    <p className="mt-1 text-sm">{p.answered_reflection}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                  {!isTestimony && (
                    <form action={togglePrayed} data-haptic="success">
                      <input type="hidden" name="id" value={p.id} />
                      <PendingButton className={`${iPrayed ? "btn-primary pw-prayed" : "btn-secondary"} btn-sm`} pendingLabel="…">
                        <HandHeart aria-hidden className="h-4 w-4" /> {iPrayed ? "You prayed" : "I prayed"}
                      </PendingButton>
                    </form>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-ink/60">
                    <Flame aria-hidden className="h-3.5 w-3.5 text-[#f0b04a]" />
                    <span className="tabular">{prayedBy.length}</span> {prayedBy.length === 1 ? "prayer" : "prayers"}
                  </span>
                  {thread.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-ink/60">
                      <MessageCircle aria-hidden className="h-3.5 w-3.5" />
                      <span className="tabular">{thread.length}</span>
                    </span>
                  )}
                  {isShepherd && !mine && (
                    <form action={removeFromWall} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmSubmitButton
                        title="Remove this request from the prayer wall?"
                        message="Only sharing is turned off — it stays on the member's private board, untouched. The removal is noted in the audit log."
                        confirmLabel="Remove from wall"
                        className="btn-ghost btn-sm"
                      >
                        Remove
                      </ConfirmSubmitButton>
                    </form>
                  )}
                  {mine && (
                    <Link href={`/dashboard/prayer-board/${p.id}/edit`} className="btn-ghost btn-sm ml-auto">
                      Edit
                    </Link>
                  )}
                </div>

                {thread.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {thread.map((c) => (
                      <li key={c.id} className="flex items-start gap-2">
                        <span aria-hidden className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ember/15 text-[10px] font-bold text-ember">
                          {initials(c.app_users?.name)}
                        </span>
                        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-ink/5 px-3 py-2 text-sm">
                          <p className="text-xs font-semibold">{c.app_users?.name ?? "Member"}</p>
                          <p className="break-words">{c.body}</p>
                        </div>
                        {(c.user_id === me.id || isShepherd) && (
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
              </div>
            </article>
          );
        })}
      </div>

      <Pagination page={page} hasMore={hasMore} hrefFor={(n) => buildQuery({ show: show === "all" ? undefined : show, category, page: n })} />
    </div>
  );
}
