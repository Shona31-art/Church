// Shown instantly while any dashboard page's server data loads (Next.js
// route convention) — a skeleton instead of a blank screen.
export default function DashboardLoading() {
  return (
    <div className="max-w-3xl space-y-4 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 rounded-lg bg-ink/10" />
      <div className="h-28 rounded-2xl bg-ink/[0.06]" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-2xl bg-ink/[0.06]" />
        <div className="h-40 rounded-2xl bg-ink/[0.06]" />
      </div>
    </div>
  );
}
