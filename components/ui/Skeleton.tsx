// Placeholder shapes for loading.tsx files: grey blocks laid out like the
// page that's coming, so the screen doesn't jump when the data arrives.
// The pulse is switched off for people who prefer reduced motion.

/** Wraps a whole loading screen and announces it to screen readers. */
export function SkeletonScreen({ label = "Loading…", className = "", children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`animate-pulse motion-reduce:animate-none ${className}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** One grey block; size it with className (h-*, w-*). */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-lg bg-ink/[0.07] ${className}`} />;
}

/** Page title, gold rule and description line, matching PageHeader. */
export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="space-y-3">
        <Bone className="h-8 w-56" />
        <Bone className="h-0.5 w-8" />
        <Bone className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Bone className="h-10 w-32 rounded-xl" />}
    </div>
  );
}

/** A card of list rows (avatar/icon, two lines of text). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card-elevated divide-y divide-line rounded-2xl">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Bone className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-1/3" />
            <Bone className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A grid of tiles (games, posters, Bible books, plans). */
export function TileGridSkeleton({ tiles = 6, className = "h-32" }: { tiles?: number; className?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: tiles }, (_, i) => (
        <Bone key={i} className={`rounded-2xl ${className}`} />
      ))}
    </div>
  );
}

/** Stacked cards with a title and a few lines (announcements, prayers, sermons, journal). */
export function CardStackSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="card-elevated space-y-3 rounded-2xl p-5">
          <Bone className="h-5 w-2/5" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-4/5" />
          <Bone className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

/** Detail page: one tall card plus a smaller one. */
export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card-elevated space-y-3 rounded-2xl p-6">
        <Bone className="h-4 w-1/3" />
        <Bone className="h-4 w-1/2" />
        <Bone className="h-4 w-2/5" />
        <Bone className="mt-4 h-24 w-full" />
      </div>
      <Bone className="h-32 rounded-2xl" />
    </div>
  );
}
