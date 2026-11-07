import { moduleGate } from "@/lib/gate";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { listColoringPages } from "@/lib/coloring/pages";
import { ColoringBook } from "./ColoringBook";
import { PagesManager } from "./PagesManager";

/** Bible colouring pages — for everyone, and in Kids mode. No scores. */
export default async function ColoringPage({ searchParams }: { searchParams: { mode?: string } }) {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const kids = searchParams.mode === "kids";
  const me = (await getCurrentAppUser())!;
  const pages = await listColoringPages(me.church_id!);
  return (
    <div className="max-w-5xl">
      <PageHeader
        back={kids ? { href: "/dashboard/games?kids=1", label: "Kids' games" } : { href: "/dashboard/games", label: "Games" }}
        title="Bible colouring"
        description="Choose a picture, pick a crayon and tap to colour. Your colouring is kept on this phone, and you can save the finished picture."
      />
      <ColoringBook pages={pages} />
      {!kids && can(me.role, "manageQuizQuestions") && <PagesManager pages={pages} />}
    </div>
  );
}
