import { moduleGate } from "@/lib/gate";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { NewChallengeForm } from "./NewChallengeForm";

/** Pastors and church admins: start a Bible challenge for the whole church. */
export default async function NewChallengePage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  if (!can(me.role, "manageQuizQuestions")) return <PermissionDenied message="Only pastors and church admins can start a church challenge." backHref="/dashboard/games/challenge" />;
  return (
    <div className="max-w-xl">
      <PageHeader back={{ href: "/dashboard/games/challenge", label: "Church challenges" }} title="New church challenge" description="Everyone in the church gets a notification and plays the same questions once. The leaderboard updates live." />
      <NewChallengeForm />
    </div>
  );
}
