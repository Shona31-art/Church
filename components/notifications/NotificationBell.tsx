"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/Toaster";
import { getNotificationsSummary, markNotificationsRead } from "@/app/dashboard/notifications/actions";
import { badgeText, type NotificationItem } from "@/lib/notifications";
import { NotificationList } from "./NotificationList";

interface BellState {
  unread: number;
  open: boolean;
  toggle: (opener: HTMLButtonElement) => void;
}

const BellContext = createContext<BellState | null>(null);

/**
 * Holds the bell's state for the whole dashboard: the unread count, one live
 * Supabase Realtime subscription (so the desktop and phone bells don't open
 * two connections), and the panel. The first count comes from the server so
 * the badge is right on first paint.
 */
export function NotificationsProvider({ userId, initialUnread, children }: { userId: string; initialUnread: number; children: React.ReactNode }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const res = await getNotificationsSummary().catch(() => null);
    if (res?.ok) {
      setUnread(res.data.unread);
      setItems(res.data.items);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, []);

  // The number on the app icon (installed app), kept in step with the bell —
  // like WhatsApp's unread badge. Phones without support just ignore it.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.())?.catch(() => undefined);
  }, [unread]);

  // Load the list the first time the panel opens.
  useEffect(() => {
    if (open && items === null) refresh();
  }, [open, items, refresh]);

  useEffect(() => setOpen(false), [pathname]);

  // Live: any change to my notifications (new, counted up, read elsewhere) →
  // refetch the summary. Debounced so a burst of chat messages is one fetch.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(refresh, 400);
      })
      .subscribe();
    // A phone that slept may have missed live updates: catch up when the tab is shown again.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, refresh]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) opener.current?.focus();
  }, []);

  const toggle = useCallback((button: HTMLButtonElement) => {
    opener.current = button;
    setOpen((o) => !o);
  }, []);

  function markOneRead(id: string) {
    setUnread((n) => Math.max(0, n - 1));
    setItems((list) => list?.map((i) => (i.id === id ? { ...i, readAt: new Date().toISOString() } : i)) ?? null);
  }

  async function markAllRead() {
    const before = { unread, items };
    setUnread(0);
    setItems((list) => list?.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })) ?? null);
    const res = await markNotificationsRead(null).catch(() => null);
    if (!res?.ok) {
      setUnread(before.unread);
      setItems(before.items);
      showToast(res && !res.ok ? res.error : "Couldn't mark notifications as read. Try again.", "error");
    }
  }

  return (
    <BellContext.Provider value={{ unread, open, toggle }}>
      {children}
      {open && (
        <NotificationsPanel
          items={items}
          failed={failed}
          unread={unread}
          onRetry={refresh}
          onClose={close}
          onMarkAllRead={markAllRead}
          onMarkedRead={markOneRead}
        />
      )}
    </BellContext.Provider>
  );
}

/** The bell button. Place it anywhere inside NotificationsProvider. */
export function NotificationBell({ className = "" }: { className?: string }) {
  const state = useContext(BellContext);
  if (!state) return null;
  const { unread, open, toggle } = state;
  return (
    <button
      type="button"
      data-notification-bell
      onClick={(e) => toggle(e.currentTarget)}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      aria-expanded={open}
      aria-controls="notifications-panel"
      aria-haspopup="dialog"
      className={`btn-ghost btn-icon relative ${className}`}
    >
      <Bell aria-hidden className="h-5 w-5" />
      {unread > 0 && (
        <span
          aria-hidden
          className="tabular absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-micro font-bold leading-none text-surface ring-2 ring-surface"
        >
          {badgeText(unread)}
        </span>
      )}
    </button>
  );
}

function NotificationsPanel({
  items,
  failed,
  unread,
  onRetry,
  onClose,
  onMarkAllRead,
  onMarkedRead,
}: {
  items: NotificationItem[] | null;
  failed: boolean;
  unread: number;
  onRetry: () => void;
  onClose: (returnFocus: boolean) => void;
  onMarkAllRead: () => void;
  onMarkedRead: (id: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(true);
    }
    // Click or tap outside closes it (the bell itself toggles, so ignore it).
    function onPointer(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (!panelRef.current?.contains(target) && !target.closest("[data-notification-bell]")) onClose(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      id="notifications-panel"
      role="dialog"
      aria-labelledby="notifications-panel-title"
      className="fixed inset-x-2 top-[62px] z-40 flex max-h-[min(75vh,36rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop motion-safe:animate-modal-in md:inset-x-auto md:left-[16.75rem] md:top-4 md:w-[24rem]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 ref={headingRef} id="notifications-panel-title" tabIndex={-1} className="font-sans text-base font-semibold outline-none">
          Notifications
        </h2>
        {unread > 0 && (
          <button type="button" onClick={onMarkAllRead} className="btn-ghost btn-sm">
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" aria-busy={items === null && !failed}>
        {items === null ? (
          failed ? (
            <div className="px-4 py-8 text-center text-sm text-ink/60" role="alert">
              Couldn&apos;t load notifications.{" "}
              <button type="button" className="link" onClick={onRetry}>
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-4" role="status" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-ink/10" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-ink/10" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-ink/10" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : items.length ? (
          <NotificationList items={items} onOpen={() => onClose(false)} onMarkedRead={onMarkedRead} />
        ) : (
          <div className="px-6 py-10 text-center">
            <Bell aria-hidden className="mx-auto h-6 w-6 text-ink/30" />
            <p className="mt-2 font-semibold">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-ink/60">New announcements, messages and prayers for you will show here.</p>
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 py-2.5 text-center">
        <Link href="/dashboard/notifications" className="link text-sm" onClick={() => onClose(false)}>
          See all notifications
        </Link>
      </div>
    </div>
  );
}
