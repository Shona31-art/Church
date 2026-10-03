/**
 * Shown when a list has nothing in it. Always says what the list is for and,
 * when the viewer can fix it, offers the action — never just "No data".
 */
export function EmptyState({
  title,
  description,
  action,
  icon = "○",
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: string;
}) {
  return (
    <div className="card-elevated rounded-2xl px-6 py-10 text-center">
      <p aria-hidden className="text-2xl text-ink/30">
        {icon}
      </p>
      <p className="mt-2 font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-ink/60 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
