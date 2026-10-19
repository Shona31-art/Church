import { Gem, Lock } from "lucide-react";
import Link from "next/link";

/**
 * Shown instead of a page when the church's plan doesn't include it, or the
 * subscription has lapsed. Tells people what to do next without exposing
 * plan keys or other internals.
 */
export function FeatureUnavailable({
  featureName,
  reason,
  kind,
  canManageBilling,
}: {
  featureName: string;
  reason?: string;
  kind?: "plan" | "suspended" | "account";
  canManageBilling: boolean;
}) {
  const title =
    kind === "suspended"
      ? "Your church's subscription has ended"
      : kind === "account"
      ? `${featureName} isn't available`
      : `${featureName} isn't included in your current plan`;

  return (
    <div className="max-w-lg card-elevated rounded-2xl p-7" role="status">
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-parchment text-gold">
        <Gem className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink/70">{reason}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {kind !== "account" &&
          (canManageBilling ? (
            <Link href="/dashboard/billing" className="btn-primary">
              {kind === "suspended" ? "Renew subscription" : "View plans"}
            </Link>
          ) : (
            <p className="text-sm text-ink/60">Ask your church admin about upgrading.</p>
          ))}
        <Link href="/dashboard" className="btn-secondary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

/** Shown when someone opens a page their role doesn't allow (e.g. via a typed URL). */
export function PermissionDenied({ message, backHref = "/dashboard" }: { message: string; backHref?: string }) {
  return (
    <div className="max-w-lg card-elevated rounded-2xl p-7" role="status">
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-parchment text-ink/60">
        <Lock className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-2 text-sm text-ink/70">{message}</p>
      <Link href={backHref} className="btn-secondary mt-5">
        Go back
      </Link>
    </div>
  );
}
