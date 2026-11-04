"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Goes to `href` after `after` ms (e.g. back to the chat when a call has already ended). */
export function AutoRedirect({ href, after = 2000 }: { href: string; after?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(href), after);
    return () => clearTimeout(t);
  }, [href, after, router]);
  return null;
}
