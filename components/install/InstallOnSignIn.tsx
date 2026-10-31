"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { useInstall } from "./install-store";
import { InstallApp } from "./InstallApp";

/**
 * On the sign-in page, phones only: people who were just sent a link (often
 * over WhatsApp) can install before signing in. Opens to the right steps for
 * this phone and browser — including "open it in Chrome/Safari" when the link
 * was opened inside WhatsApp or Facebook, where installing isn't possible.
 */
export function InstallOnSignIn() {
  const { mode } = useInstall();
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(window.matchMedia("(pointer: coarse)").matches), []);

  if (!phone || mode === null || mode === "installed") return null;
  return (
    <details className="mt-5 rounded-2xl border border-line bg-surface p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <Smartphone aria-hidden className="h-4 w-4 text-gold" /> Install Grace on your phone
      </summary>
      <div className="mt-3">
        <InstallApp />
      </div>
    </details>
  );
}
