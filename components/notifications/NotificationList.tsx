"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  HandHeart,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  ShieldAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { showToast } from "@/components/ui/Toaster";
import { markNotificationsRead } from "@/app/dashboard/notifications/actions";
import { relativeTime, safeNotificationLink, type NotificationItem } from "@/lib/notifications";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

const ICONS: Record<string, LucideIcon> = {
  announcement: Megaphone,
  event: CalendarDays,
  chat: MessageCircle,
  prayer: HandHeart,
  booking: CalendarCheck,
  support: LifeBuoy,
  counseling: ShieldAlert,
  member: UserPlus,
};

/**
 * A list of notifications (the bell's panel and the full page). Tapping one
 * marks it read and opens what it's about. Unread items carry a dot, bold
 * title and screen-reader text, so status never depends on colour alone.
 */
export function NotificationList({
  items,
  onOpen,
  onMarkedRead,
}: {
  items: NotificationItem[];
  /** Called before navigating, e.g. to close the panel. */
  onOpen?: () => void;
  /** Lets the bell update its badge straight away. */
  onMarkedRead?: (id: string) => void;
}) {
  const router = useRouter();

  function open(item: NotificationItem) {
    onOpen?.();
    if (!item.readAt) {
      onMarkedRead?.(item.id);
      callAction(() => markNotificationsRead([item.id]), { ok: false, error: CONNECTION_FAILED }).then((res) => {
        if (!res.ok) showToast(res.error, "error");
      });
    }
    router.push(safeNotificationLink(item.link));
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const Icon = ICONS[item.type.split(".")[0]] ?? Bell;
        const unread = !item.readAt;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-raised ${unread ? "" : "opacity-75"}`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  item.category === "alerts" ? "bg-warning-tint text-warning" : "bg-surface-raised text-ink/60"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${unread ? "font-semibold text-ink" : "text-ink/80"}`}>
                  {unread && <span className="sr-only">Unread: </span>}
                  {item.title}
                </span>
                {item.body && <span className="line-clamp-2 block text-sm text-ink/60">{item.body}</span>}
                <span className="tabular mt-0.5 block text-xs text-ink/60">{relativeTime(item.updatedAt)}</span>
              </span>
              {unread && <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-ember" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
