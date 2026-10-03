import Link from "next/link";

// Shown inside the dashboard when a record doesn't exist — or belongs to
// another church (we deliberately don't say which, so IDs can't be probed).
export default function DashboardNotFound() {
  return (
    <div className="max-w-lg card-elevated rounded-2xl p-6" role="status">
      <p aria-hidden className="text-2xl text-ink/30">?</p>
      <h1 className="mt-2 text-xl font-semibold">We couldn&apos;t find that</h1>
      <p className="mt-2 text-sm text-ink/70">
        It may have been deleted, or the link may be wrong. If someone sent it to you, check they&apos;re in the same church.
      </p>
      <Link href="/dashboard" className="btn-secondary mt-5">
        Back to dashboard
      </Link>
    </div>
  );
}
