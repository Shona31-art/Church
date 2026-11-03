import { z } from "zod";
import { moduleGate } from "@/lib/gate";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { getAvatarUrls } from "@/lib/avatars";
import { duelCandidates } from "../actions";
import { NewDuelForm } from "./NewDuelForm";

/** Challenge someone: who, how hard, how many questions. `?with=` picks the person (e.g. from a chat). */
export default async function NewDuelPage({ searchParams }: { searchParams: { with?: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const { people, error } = await duelCandidates();
  const photos = await getAvatarUrls((people ?? []).map((p) => p.id));
  const preset = z.string().uuid().safeParse(searchParams.with).success ? searchParams.with! : null;
  return (
    <div className="max-w-xl">
      <PageHeader back={{ href: "/dashboard/games/duel", label: "Bible duels" }} title="Challenge someone" description="You'll both answer the same questions against the clock. Most right answers wins; a tie goes to the quicker player." />
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : (
        <NewDuelForm people={(people ?? []).map((p) => ({ ...p, photoUrl: photos.get(p.id) ?? null }))} preset={preset} />
      )}
    </div>
  );
}
