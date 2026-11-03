import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BibleReader } from "@/components/bible/BibleReader";
import { Toaster } from "@/components/ui/Toaster";
import { OfflineBanner } from "@/components/OfflineBanner";

export const metadata: Metadata = { title: "Bible" };

/**
 * /bible — the Bible reader without signing in, so a downloaded Bible can be
 * read when signed out or with no connection (signing in needs one). The
 * text is public domain and the page shows nothing personal, so the service
 * worker keeps it even after sign-out. Highlights and notes need signing in
 * (the member's reader is /dashboard/bible/read).
 */
export default function PublicBiblePage() {
  return (
    <div className="min-h-dvh bg-parchment">
      <OfflineBanner />
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-display text-xl font-semibold italic text-gold">Grace</span>
        <Link href="/login" className="btn-secondary btn-sm">
          Sign in
        </Link>
      </header>
      <main className="px-4 pb-16 pt-2">
        <Suspense fallback={<p className="text-center text-sm text-ink/60">Opening the Bible…</p>}>
          <BibleReader guest />
        </Suspense>
      </main>
      <Toaster />
    </div>
  );
}
