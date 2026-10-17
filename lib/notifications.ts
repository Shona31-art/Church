// Notification bell: shared types and display helpers (server and client).
// Rows are created only by database triggers — see supabase/notifications.sql.

export const CATEGORIES = ["church_news", "messages", "prayer_care", "alerts"] as const;
export type NotificationCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  church_news: { label: "Church news", description: "New announcements and events" },
  messages: { label: "Messages", description: "Direct messages and chats you're in" },
  prayer_care: { label: "Prayer & care", description: "Prayers for you, bookings, support replies" },
  alerts: { label: "Pastor & admin alerts", description: "Counseling escalations, booking requests, new members" },
};

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  count: number;
  readAt: string | null;
  updatedAt: string;
}

/** The columns every notification list selects, and how a row maps to NotificationItem. */
export const NOTIFICATION_COLUMNS = "id, category, type, title, body, link, count, read_at, updated_at";
export function toNotificationItem(row: {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  count: number;
  read_at: string | null;
  updated_at: string;
}): NotificationItem {
  return {
    id: row.id,
    category: row.category as NotificationCategory,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    count: row.count,
    readAt: row.read_at,
    updatedAt: row.updated_at,
  };
}

/** Only ever navigate inside the app (links come from our own triggers, but never trust stored URLs blindly). */
export function safeNotificationLink(link: string | null): string {
  return link && link.startsWith("/dashboard") && !link.startsWith("//") ? link : "/dashboard/notifications";
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", "12 Oct", "12 Oct 2025". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86_400);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString("en-ZA", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Badge text: "1"…"99", then "99+". */
export function badgeText(unread: number): string {
  return unread > 99 ? "99+" : String(unread);
}
