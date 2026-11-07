import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { formatDate } from "@/lib/format";
import { duelPhase, otherSide, sideOf, type DuelRow } from "@/lib/games/duel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrls } from "@/lib/avatars";
import { settleDuel } from "./actions";
import { RespondButtons } from "./RespondButtons";

type Listed = DuelRow & { challenger: { name: string } | null; opponent: { name: string } | null };

/** Bible duels: challenges for me, games in progress, and results. */
export default async function DuelsPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;

  const load = () =>
    createClient()
      .from("game_duels")
      .select("*, challenger:app_users!game_duels_challenger_id_fkey(name), opponent:app_users!game_duels_opponent_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(60);
  let { data, error } = await load();
  // Duels whose time ran out are settled when someone looks.
  const stale = ((data ?? []) as Listed[]).filter((d) => ["pending", "active"].includes(d.status) && new Date(d.expires_at).getTime() <= Date.now());
  if (stale.length) {
    await Promise.all(stale.map((d) => settleDuel(d.id)));
    ({ data, error } = await load());
  }
  const duels = (data ?? []) as Listed[];
  const photos = await getAvatarUrls([...new Set(duels.flatMap((d) => [d.challenger_id, d.opponent_id]))]);

  const name = (d: Listed, side: "challenger" | "opponent") => d[side]?.name ?? "Former member";
  const rows = duels.map((d) => {
    const side = sideOf(d, me.id)!;
    const them = otherSide(side);
    return { d, side, them, theirName: name(d, them), theirId: d[`${them}_id`], phase: duelPhase(d, me.id) };
  });
  const forMe = rows.filter((r) => r.phase === "respond");
  const myTurn = rows.filter((r) => r.phase === "ready" || r.phase === "playing");
  const waiting = rows.filter((r) => r.phase === "waiting");
  // Only duels both people played count (a "win" over someone who never
  // accepted isn't one); older results like that show as "Not played".
  const played = (d: Listed) => Boolean(d.challenger_started_at && d.opponent_started_at);
  const done = rows.filter((r) => r.phase === "finished" && played(r.d));
  const unplayed = rows.filter((r) => (r.phase === "finished" && !played(r.d)) || (r.phase === "cancelled" && r.d[`${r.side}_started_at`]));
  const record = done.reduce((t, r) => (r.d.winner_id === me.id ? { ...t, w: t.w + 1 } : r.d.winner_id ? { ...t, l: t.l + 1 } : { ...t, d: t.d + 1 }), { w: 0, l: 0, d: 0 });

  const Row = ({ r, children }: { r: (typeof rows)[number]; children?: React.ReactNode }) => (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <Avatar name={r.theirName} src={photos.get(r.theirId) ?? null} size="md" />
      <Link href={`/dashboard/games/duel/${r.d.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium">{r.theirName}</p>
        <p className="text-xs text-ink/60">
          {r.d.level[0].toUpperCase() + r.d.level.slice(1)} · {r.d.questions.length} questions · {formatDate(r.d.created_at)}
        </p>
      </Link>
      {children}
    </li>
  );

  return (
    <div className="max-w-2xl">
      <PageHeader
        back={{ href: "/dashboard/games", label: "Games" }}
        title={
          <span className="flex items-center gap-3">
            <Swords aria-hidden className="h-7 w-7 text-gold" /> Bible duels
          </span>
        }
        description="Challenge someone to the same Bible quiz. Most right answers wins — if it's a tie, the quicker player."
        actions={
          <Link href="/dashboard/games/duel/new" className="btn-primary">
            <Swords aria-hidden className="h-4 w-4" /> Challenge someone
          </Link>
        }
      />
      {error && <Alert tone="info" title="One step left">Bible duels need a database update first: ask your church admin to run supabase/game_duels.sql.</Alert>}

      {done.length > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-3 text-center">
          {[
            ["Won", record.w],
            ["Lost", record.l],
            ["Drawn", record.d],
          ].map(([label, n]) => (
            <div key={label} className="card-elevated rounded-2xl p-4">
              <p className="font-display text-3xl font-semibold tabular">{n}</p>
              <p className="text-xs uppercase tracking-wide text-ink/60">{label}</p>
            </div>
          ))}
        </div>
      )}

      {forMe.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Challenges for you</h2>
          <ul className="space-y-2">
            {forMe.map((r) => (
              <Row key={r.d.id} r={r}>
                <RespondButtons duelId={r.d.id} />
              </Row>
            ))}
          </ul>
        </section>
      )}

      {myTurn.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Your turn</h2>
          <ul className="space-y-2">
            {myTurn.map((r) => (
              <Row key={r.d.id} r={r}>
                <Link href={`/dashboard/games/duel/${r.d.id}`} className="btn-primary btn-sm shrink-0">
                  {r.phase === "playing" ? "Carry on" : "Play"}
                </Link>
              </Row>
            ))}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Waiting for them</h2>
          <ul className="space-y-2">
            {waiting.map((r) => (
              <Row key={r.d.id} r={r}>
                <span className="shrink-0 text-xs text-ink/60">
                  {r.d.status === "pending" ? "Not accepted yet" : `${r.d[`${r.them}_done`]}/${r.d.questions.length} answered`}
                </span>
              </Row>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Results</h2>
          <ul className="space-y-2">
            {done.slice(0, 20).map((r) => {
              const won = r.d.winner_id === me.id;
              const drew = !r.d.winner_id;
              return (
                <Row key={r.d.id} r={r}>
                  <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${won ? "bg-gold/15 text-ink" : drew ? "bg-ink/5 text-ink/70" : "bg-ink/5 text-ink/60"}`}>
                    {won && <Trophy aria-hidden className="h-3.5 w-3.5 text-gold" />}
                    {won ? "Won" : drew ? "Draw" : "Lost"} {r.d[`${r.side}_score`] ?? 0}–{r.d[`${r.them}_score`] ?? 0}
                  </span>
                </Row>
              );
            })}
          </ul>
        </section>
      )}

      {unplayed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Not played</h2>
          <ul className="space-y-2">
            {unplayed.slice(0, 10).map((r) => (
              <Row key={r.d.id} r={r}>
                <span className="shrink-0 text-xs text-ink/60">{r.d[`${r.them}_started_at`] ? "You didn't play — not counted" : "They didn't play — not counted"}</span>
              </Row>
            ))}
          </ul>
        </section>
      )}

      {!error && !rows.some((r) => ["respond", "ready", "playing", "waiting", "finished"].includes(r.phase)) && (
        <div className="card-elevated rounded-2xl p-8 text-center">
          <Swords aria-hidden className="mx-auto h-10 w-10 text-gold" />
          <p className="mt-3 font-display text-xl font-semibold">No duels yet</p>
          <p className="mt-1 text-sm text-ink/60">Challenge a friend from church — you&apos;ll both get the same questions.</p>
          <Link href="/dashboard/games/duel/new" className="btn-primary mt-5">
            Challenge someone
          </Link>
        </div>
      )}
    </div>
  );
}
