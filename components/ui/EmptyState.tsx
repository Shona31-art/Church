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
      <span aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-parchment text-gold-deep">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <p className="mt-5 font-display text-2xl font-medium">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink/60">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
