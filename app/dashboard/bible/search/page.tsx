import { Suspense } from "react";
import { moduleGate } from "@/lib/gate";
import { PageHeader } from "@/components/ui/PageHeader";
import { BibleSearch } from "@/components/bible/BibleSearch";

// Whole-Bible word search. Runs in the browser over the static text files
// (lib/bible/search.ts), so it costs nothing to run and works offline once a
// version is downloaded.
export default async function BibleSearchPage() {
  const gate = await moduleGate("bible");
  if (gate) return gate;

  return (
    <>
      <PageHeader title="Search the Bible" back={{ href: "/dashboard/bible", label: "Bible" }} />
      {/* The search reads its query from the URL (useSearchParams), which needs a Suspense boundary. */}
      <Suspense fallback={<p className="text-sm text-ink/60">Loading search…</p>}>
        <BibleSearch />
      </Suspense>
    </>
  );
}
