"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Banner {
  id: string;
  title: string;
  body: string | null;
  link: string;
  count: number;
}

/**
 * WhatsApp-style banner: when a chat message arrives while you're somewhere
 * else in the app, it slides in at the top for a few seconds ("Alice — See you
 * at 6"); tap it to open the chat. Not shown inside that chat itself. Uses the
 * same notifications the bell does, so muted chats and blocked people stay quiet.
 */
export function MessageBanner({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [banner, setBanner] = useState<Banner | null>(null);
  const seen = useRef(new Map<string, number>()); // notification id → last count shown
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`message-banner:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, ({ new: row }) => {
        const n = row as { id?: string; type?: string; title?: string; body?: string | null; link?: string | null; count?: number; read_at?: string | null };
        if (!n?.id || n.type !== "chat.message" || n.read_at || !n.link || !n.title) return;
        const count = n.count ?? 1;
        // Only a new message (not "marked read" or a preview being replaced).
        if ((seen.current.get(n.id) ?? 0) >= count) return;
        seen.current.set(n.id, count);
        if (pathRef.current === n.link) return; // already reading that chat
        setBanner({ id: n.id, title: n.title, body: n.body ?? null, link: n.link, count });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Disappears on its own, and when you go to that chat.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);
  useEffect(() => {
    if (banner && pathname === banner.link) setBanner(null);
  }, [pathname, banner]);

  if (!banner) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-[90] mx-auto max-w-sm motion-safe:animate-modal-in sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 shadow-pop">
        <Link href={banner.link} onClick={() => setBanner(null)} className="flex min-w-0 flex-1 items-start gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {banner.title}
              {banner.count > 1 && <span className="font-normal text-ink/60"> · {banner.count} messages</span>}
            </span>
            {banner.body && <span className="line-clamp-2 block text-sm text-ink/70">{banner.body}</span>}
          </span>
        </Link>
        <button type="button" onClick={() => setBanner(null)} className="btn-ghost btn-icon -m-1 h-8 w-8 shrink-0" aria-label="Dismiss">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
