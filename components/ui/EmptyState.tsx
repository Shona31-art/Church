import { Inbox, type LucideIcon } from "lucide-react";

/**
 * Shown when a list has nothing in it. Always says what the list is for and,
 * when the viewer can fix it, offers the action — never just "No data".
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="card-elevated rounded-2xl px-6 py-12 text-center">
      <span aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-parchment text-gold">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-display text-lg font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink/60">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
