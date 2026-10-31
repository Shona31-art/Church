import { isAiConfigured } from "@/lib/ai";
import { StudyTool } from "./StudyTool";
import { moduleGate } from "@/lib/gate";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function BibleStudyPage({ searchParams }: { searchParams: { ref?: string } }) {
  const gate = await moduleGate("bible_study_ai");
  if (gate) return gate;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Bible study"
        back={{ href: "/dashboard/bible", label: "Bible" }}
        description="Explanations, devotionals, cross-references and reading plans for any passage or topic."
      />
      {!isAiConfigured() && (
        <Alert tone="warning" className="mb-6">
          AI isn&apos;t configured on this server yet (ANTHROPIC_API_KEY or GEMINI_API_KEY), so study notes won&apos;t generate. You can still read any passage in the Bible reader.
        </Alert>
      )}
      <StudyTool initialQuery={(searchParams.ref ?? "").slice(0, 200)} />
    </div>
  );
}
