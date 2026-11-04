"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A settings section that opens like a dropdown, so long pages (My account)
 * stay short. Opens by itself when the address points at it (e.g.
 * /dashboard/account#notifications) or when `defaultOpen`.
 */
export function CollapsibleSection({ title, description, anchor, defaultOpen = false, children }: { title: string; description?: React.ReactNode; anchor?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const openIfLinked = () => {
      if (anchor && window.location.hash === `#${anchor}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ block: "start" });
      }
    };
    openIfLinked();
    window.addEventListener("hashchange", openIfLinked);
    return () => window.removeEventListener("hashchange", openIfLinked);
  }, [anchor]);

  return (
    <details ref={ref} id={anchor} open={defaultOpen} className="group card-elevated scroll-mt-24 rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xl font-semibold">{title}</span>
          {description && <span className="mt-1 block text-sm text-ink/60">{description}</span>}
        </span>
        <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-ink/60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 sm:px-7 sm:pb-7">{children}</div>
    </details>
  );
}
