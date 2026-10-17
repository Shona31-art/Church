import { Suspense } from "react";
import { moduleGate } from "@/lib/gate";
import { BibleReader } from "@/components/bible/BibleReader";

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
    <Suspense fallback={<p className="text-sm text-ink/55">Opening the Bible…</p>}>
      <BibleReader />
    </Suspense>
  );
}
