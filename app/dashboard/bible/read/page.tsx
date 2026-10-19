import { Suspense } from "react";
import { moduleGate } from "@/lib/gate";
import { BibleReader } from "@/components/bible/BibleReader";
import { Bone, SkeletonScreen } from "@/components/ui/Skeleton";

// Server shell for the Bible reader: checks the church's plan includes the
// Bible, then hands over to the client reader, which loads text from the
// static files in public/bibles/ (see docs/adr/0001-bible-text-hosting-and-offline.md).
// This page renders no personal data, so it's safe for the service worker
// to keep a copy for offline reading.
export default async function BibleReaderPage() {
  const gate = await moduleGate("bible");
  if (gate) return gate;

  return (
    // The reader reads the passage from the URL (useSearchParams), which needs a Suspense boundary.
    <Suspense
      fallback={
        <SkeletonScreen label="Opening the Bible…" className="mx-auto max-w-2xl space-y-3">
          <Bone className="mb-8 h-10 w-48" />
          {Array.from({ length: 10 }, (_, i) => (
            <Bone key={i} className={`h-4 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
          ))}
        </SkeletonScreen>
      }
    >
      <BibleReader />
    </Suspense>
  );
}
