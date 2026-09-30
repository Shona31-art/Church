import Link from "next/link";
import { checkModuleAccess } from "@/lib/paywall";
import { isAiConfigured } from "@/lib/ai";
import { StudyTool } from "./StudyTool";

export default async function BibleStudyPage({ searchParams }: { searchParams: { ref?: string } }) {
  const access = await checkModuleAccess("bible_study_ai");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bible" className="text-sm text-ink/50 hover:text-ink">← Bible</Link>
      <h1 className="text-2xl font-semibold mt-2">Bible study</h1>
      <p className="text-sm text-ink/50 mt-1 mb-6">Explanations, devotionals, cross-references and reading plans for any passage or topic.</p>
      {!isAiConfigured() && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          ⚠ AI isn&apos;t configured on this server yet (ANTHROPIC_API_KEY), so study notes won&apos;t generate. You can still read any passage in the Bible reader.
        </p>
      )}
      <StudyTool initialQuery={(searchParams.ref ?? "").slice(0, 200)} />
    </div>
  );
}
