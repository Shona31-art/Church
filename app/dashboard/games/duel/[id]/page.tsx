import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { getAvatarUrls } from "@/lib/avatars";
import { otherSide, sideOf, type DuelRow } from "@/lib/games/duel";
import { duelReview, settleDuel } from "../actions";
import { DuelRoom } from "./DuelRoom";

/** One Bible duel: accept it, play it, wait for the other player, see who won. */
export default async function DuelPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;

  const load = () => createClient().from("game_duels").select("*").eq("id", params.id).maybeSingle();
  let { data } = await load();
  if (!data) notFound();
  // Time ran out: settle it now (unanswered questions count as wrong).
  if (["pending", "active"].includes(data.status) && new Date(data.expires_at).getTime() <= Date.now()) {
    await settleDuel(params.id);
    ({ data } = await load());
  }
  const duel = data as DuelRow;
  const side = sideOf(duel, me.id);
  if (!side) notFound();
  const themId = duel[`${otherSide(side)}_id`];
  const [{ data: them }, photos, review] = await Promise.all([
    createClient().from("app_users").select("name").eq("id", themId).maybeSingle(),
    getAvatarUrls([me.id, themId]),
    duel.status === "finished" ? duelReview(params.id) : Promise.resolve(null),
  ]);

  return (
    <DuelRoom
      initial={duel}
      meId={me.id}
      me={{ name: me.name, photoUrl: photos.get(me.id) ?? null }}
      them={{ id: themId, name: them?.name ?? "Former member", photoUrl: photos.get(themId) ?? null }}
      review={review}
    />
  );
}
