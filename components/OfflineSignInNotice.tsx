"use client";

import { useEffect, useState } from "react";
import { BookOpen, WifiOff } from "lucide-react";

/**
 * On the sign-in page with no connection: signing in needs the internet (the
 * server checks your password), but a downloaded Bible still opens at /bible.
 */
export function OfflineSignInNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="rounded-2xl border border-line bg-surface p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <WifiOff aria-hidden className="h-4 w-4" /> You&apos;re offline
      </p>
      <p className="mt-1 text-ink/70">Signing in needs an internet connection. You can still read a Bible you&apos;ve downloaded on this phone.</p>
      <a href="/bible" className="btn-secondary btn-sm mt-3">
        <BookOpen aria-hidden className="h-4 w-4" /> Read the Bible offline
      </a>
    </div>
  );
}
