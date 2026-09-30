import Stripe from "stripe";

// A guarded singleton, not a top-level `new Stripe(...)` call — this file
// gets imported by pages that don't touch billing too, and throwing at
// import time (rather than at first use) would break the whole app for
// anyone who hasn't set up Stripe yet.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set — billing features are disabled until it is.");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

// Maps our internal plan keys to Stripe Price IDs (set these up in the
// Stripe Dashboard → Product catalog, test mode is free). free_trial and
// sponsored are deliberately absent — they're never purchased via Stripe.
export const STRIPE_PRICE_IDS: Record<string, string | undefined> = {
  basic: process.env.STRIPE_PRICE_BASIC,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};
