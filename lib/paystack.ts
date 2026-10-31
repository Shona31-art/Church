import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Paystack API client (card giving — docs/plans/paystack-card-giving.md).
// Server only: the secret key must never reach the browser. Request/response
// shapes follow Paystack's official OpenAPI spec (github.com/PaystackOSS/openapi).
// Every call has a timeout and throws PaystackError with a message that's
// safe to log (never shown to members as-is).

const BASE_URL = "https://api.paystack.co";
const TIMEOUT_MS = 15_000;

export class PaystackError extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message);
    this.name = "PaystackError";
  }
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new PaystackError("PAYSTACK_SECRET_KEY is not set");
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new PaystackError(`request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  let json: { status?: boolean; message?: string; data?: T } | null = null;
  try {
    json = await response.json();
  } catch {
    // fall through to the error below
  }
  if (!response.ok || !json?.status) {
    throw new PaystackError(json?.message ?? `HTTP ${response.status}`, response.status);
  }
  return json.data as T;
}

/** Starts a card payment for a church. Returns the Paystack page to send the member to. */
export async function initializeTransaction(input: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  subaccountCode: string;
  metadata: Record<string, string>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const data = await call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountCents, // smallest unit: cents
      currency: "ZAR",
      reference: input.reference,
      callback_url: input.callbackUrl,
      subaccount: input.subaccountCode,
      // The church's share carries Paystack's fee; the platform keeps 0 %.
      bearer: "subaccount",
      channels: ["card"],
      metadata: input.metadata,
    },
  });
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export interface VerifiedTransaction {
  status: string; // "success" | "failed" | "abandoned" | "reversed" | "ongoing" | "pending" | …
  amountCents: number;
  currency: string;
  reference: string;
  metadata: Record<string, unknown>;
  /** CUS_… — set for every transaction; used to find the church for subscription renewals. */
  customerCode?: string;
  /** PLN_… — only for subscription payments. */
  planCode?: string;
}

/** Asks Paystack what happened to a payment. The only source we trust for "paid". */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await call<{
    status: string;
    amount: number;
    currency: string;
    reference: string;
    metadata: unknown;
    customer?: { customer_code?: string } | null;
    plan?: { plan_code?: string } | string | null;
    plan_object?: { plan_code?: string } | null;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  let metadata: Record<string, unknown> = {};
  if (data.metadata && typeof data.metadata === "object") metadata = data.metadata as Record<string, unknown>;
  else if (typeof data.metadata === "string") {
    try {
      metadata = JSON.parse(data.metadata);
    } catch {
      metadata = {};
    }
  }
  const planCode = typeof data.plan === "string" ? data.plan : data.plan?.plan_code ?? data.plan_object?.plan_code;
  return {
    status: data.status,
    amountCents: data.amount,
    currency: data.currency,
    reference: data.reference,
    metadata,
    customerCode: data.customer?.customer_code || undefined,
    planCode: planCode && planCode.startsWith("PLN_") ? planCode : undefined,
  };
}

// ---------------------------------------------------------------------------
// Church subscriptions (online billing — docs/plans/paystack-billing.md).
// Paid to the platform's own Paystack balance, not a church subaccount.
// ---------------------------------------------------------------------------

/**
 * Starts a subscription checkout: the first month is charged now and Paystack
 * creates the subscription on the plan (PLN_…), then charges it monthly.
 * Paystack uses the plan's amount; we send the same amount so a mismatch
 * between the plan and our catalogue shows up as a verification mismatch.
 */
export async function initializeSubscriptionCheckout(input: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  planCode: string;
  metadata: Record<string, string>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const data = await call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountCents,
      currency: "ZAR",
      reference: input.reference,
      callback_url: input.callbackUrl,
      plan: input.planCode,
      channels: ["card"],
      metadata: input.metadata,
    },
  });
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export interface PaystackSubscription {
  subscriptionCode: string;
  status: string; // "active" | "non-renewing" | "attention" | "completed" | "cancelled"
  emailToken: string;
  customerCode: string;
  planCode: string;
  nextPaymentDate: string | null;
}

/** Reads a subscription from Paystack (webhook bodies are checked against this). */
export async function fetchSubscription(code: string): Promise<PaystackSubscription> {
  const data = await call<{
    subscription_code: string;
    status: string;
    email_token: string;
    next_payment_date: string | null;
    customer: { customer_code: string } | null;
    plan: { plan_code: string } | null;
  }>(`/subscription/${encodeURIComponent(code)}`);
  return {
    subscriptionCode: data.subscription_code,
    status: data.status,
    emailToken: data.email_token,
    customerCode: data.customer?.customer_code ?? "",
    planCode: data.plan?.plan_code ?? "",
    nextPaymentDate: data.next_payment_date,
  };
}

/** Stops future charges. The church keeps access until the period it paid for ends. */
export async function disableSubscription(code: string, emailToken: string): Promise<void> {
  await call("/subscription/disable", { method: "POST", body: { code, token: emailToken } });
}

interface SubaccountInput {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  contactEmail: string;
}

function subaccountBody(input: SubaccountInput) {
  return {
    business_name: input.businessName,
    settlement_bank: input.bankCode,
    account_number: input.accountNumber,
    percentage_charge: 0, // Grace-bound Ventures takes nothing from gifts
    primary_contact_email: input.contactEmail,
    description: "Card giving for this church (Grace by Grace-bound Ventures)",
  };
}

/** Creates the church's subaccount — card gifts settle to its bank account. */
export async function createSubaccount(input: SubaccountInput): Promise<{ subaccountCode: string }> {
  const data = await call<{ subaccount_code: string }>("/subaccount", { method: "POST", body: subaccountBody(input) });
  return { subaccountCode: data.subaccount_code };
}

/** Points an existing subaccount at (possibly new) bank details. */
export async function updateSubaccount(code: string, input: SubaccountInput): Promise<{ subaccountCode: string }> {
  const data = await call<{ subaccount_code: string }>(`/subaccount/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: { ...subaccountBody(input), active: true },
  });
  return { subaccountCode: data.subaccount_code ?? code };
}

/**
 * Webhook check: Paystack signs the raw request body with HMAC SHA-512 using
 * the secret key, in the x-paystack-signature header. Compare in constant
 * time; anything else (missing key, missing header, wrong length) is false.
 */
export function isValidWebhookSignature(rawBody: string, signature: string | null, secret = process.env.PAYSTACK_SECRET_KEY): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Changes a Paystack plan's price (new subscriptions pay the new amount;
 * existing subscribers keep theirs until they subscribe again).
 */
export async function updatePlanAmount(planCode: string, amountCents: number): Promise<void> {
  await call(`/plan/${encodeURIComponent(planCode)}`, {
    method: "PUT",
    body: { amount: amountCents, currency: "ZAR", update_existing_subscriptions: false },
  });
}
