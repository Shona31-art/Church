// Billing rules shared by the Stripe webhook and the billing page (pure).

/**
 * What a Stripe subscription status means for church access.
 *   active / trialing           → active
 *   past_due / unpaid / incomplete → grace (access continues, admin warned)
 *   canceled / incomplete_expired / paused → suspended
 * Unknown future statuses change nothing (null) rather than locking a church out.
 */
export function planForStripeStatus(status: string): "active" | "grace" | "suspended" | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "grace";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "suspended";
    default:
      return null;
  }
}

/** Plans a church admin can buy online (others are arranged by the platform team). */
export const SELF_SERVE_PLANS = ["basic", "premium"] as const;
