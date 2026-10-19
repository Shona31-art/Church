import Link from "next/link";
import { isAiConfigured } from "@/lib/ai";
import { StudyTool } from "./StudyTool";
import { moduleGate } from "@/lib/gate";
import { Alert } from "@/components/ui/Alert";

export default async function BibleStudyPage({ searchParams }: { searchParams: { ref?: string } }) {
  const gate = await moduleGate("bible_study_ai");
  if (gate) return gate;

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bible" className="text-sm text-ink/50 hover:text-ink">← Bible</Link>
      <h1 className="text-2xl font-semibold mt-2">Bible study</h1>
      <p className="text-sm text-ink/50 mt-1 mb-6">Explanations, devotionals, cross-references and reading plans for any passage or topic.</p>
      {!isAiConfigured() && (
        <Alert tone="warning" className="mb-6">
          AI isn&apos;t configured on this server yet (ANTHROPIC_API_KEY), so study notes won&apos;t generate. You can still read any passage in the Bible reader.
        </Alert>
      )}
      <StudyTool initialQuery={(searchParams.ref ?? "").slice(0, 200)} />
    </div>
  );
}
