import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { PAGE_SIZE, buildQuery, pageFrom } from "@/lib/list";
import { NOTIFICATION_COLUMNS, toNotificationItem } from "@/lib/notifications";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { NotificationList } from "@/components/notifications/NotificationList";
import { clearReadAction, markAllReadAction } from "./actions";

/**
 * Every notification for the signed-in person, newest first, 25 a page,
 * with an Unread filter, "Mark all as read" and "Clear read". RLS limits the
 * query to their own rows; the explicit user_id filter keeps it fast.
 */
export default async function NotificationsPage({ searchParams }: { searchParams: { page?: string; filter?: string } }) {
  const me = await getCurrentAppUser();
  const page = pageFrom(searchParams.page);
  const unreadOnly = searchParams.filter === "unread";
  const supabase = createClient();

  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS, { count: "exact" })
    .eq("user_id", me!.id)
    .order("updated_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (unreadOnly) query = query.is("read_at", null);
  const [{ data, count, error }, unreadRes] = await Promise.all([
    query,
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me!.id).is("read_at", null),
  ]);
  if (error) console.error("[notifications] page failed:", error.message);

  const items = (data ?? []).map(toNotificationItem);
  const total = count ?? 0;
  const unread = unreadRes.count ?? 0;
  const tab = (filter: string | undefined, label: string) => {
    const active = (filter === "unread") === unreadOnly;
    return (
      <Link
        href={`/dashboard/notifications${buildQuery({ filter })}`}
        aria-current={active ? "page" : undefined}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-surface text-ink shadow-xs" : "text-ink/60 hover:text-ink"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Notifications"
        description="Announcements, messages, prayers for you and alerts. Kept for 90 days."
        actions={
          <Link href="/dashboard/account#notifications" className="btn-secondary">
            <Settings aria-hidden className="h-4 w-4" />
            Pop-up settings
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter" className="flex gap-1 rounded-xl border border-line bg-surface-raised p-1">
          {tab(undefined, "All")}
          {tab("unread", unread ? `Unread (${unread})` : "Unread")}
        </nav>
        <div className="flex flex-wrap gap-2">
          {unread > 0 && (
            <form action={markAllReadAction}>
              <button type="submit" className="btn-secondary btn-sm">
                Mark all as read
              </button>
            </form>
          )}
          {total > 0 && !unreadOnly && (
            <form action={clearReadAction}>
              <ConfirmSubmitButton
                title="Clear read notifications?"
                message="Notifications you've already read will be deleted. Unread ones stay. This can't be undone."
                confirmLabel="Clear read"
                className="btn-ghost btn-sm"
                pendingLabel="Clearing…"
              >
                Clear read
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="Couldn't load your notifications">
          Refresh the page to try again.
        </Alert>
      ) : items.length ? (
        <div className="card-elevated overflow-hidden rounded-2xl">
          <NotificationList items={items} />
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? "Nothing unread" : "No notifications yet"}
          description={
            unreadOnly
              ? "You're all caught up."
              : "When there's a new announcement, a message for you, or someone prays for your request, it will show here."
          }
        />
      )}

      <Pagination
        page={page}
        hasMore={(page + 1) * PAGE_SIZE < total}
        hrefFor={(p) => `/dashboard/notifications${buildQuery({ filter: unreadOnly ? "unread" : undefined, page: p })}`}
      />
    </div>
  );
}
