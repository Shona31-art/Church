"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * A slim bar while there's no connection: pages opened earlier (Home,
 * Announcements, Calendar, Songs, Sermons, the Bible) are saved copies,
 * and anything that sends or loads new things waits for the connection.
 */
export function OfflineBanner() {
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
    <div role="status" className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-ink px-3 py-1.5 text-center text-xs font-medium text-parchment">
      <WifiOff aria-hidden className="h-3.5 w-3.5 shrink-0" />
      You&apos;re offline — showing saved pages. Your downloaded Bible works fully.
    </div>
  );
}
