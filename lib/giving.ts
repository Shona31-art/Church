import { z } from "zod";

// Giving constants shared by the form, the checkout action and the report.

export const GIVING_FUNDS = ["general", "tithe", "missions", "building"] as const;
export type GivingFund = (typeof GIVING_FUNDS)[number];

export const FUND_LABELS: Record<GivingFund, string> = {
  general: "General fund",
  tithe: "Tithe",
  missions: "Missions",
  building: "Building fund",
};

export function fundLabel(fund: string): string {
  return FUND_LABELS[fund as GivingFund] ?? fund.replaceAll("_", " ");
}

// Card payments below ~R10 cost more in fees than they raise; the upper
// bound stops typos like R100000 instead of R1000 reaching the card form.
export const MIN_GIFT_RAND = 10;
export const MAX_GIFT_RAND = 100_000;

/** Parses "250", "250.50" or "1 250,50" into cents, or null if invalid. */
export function randToCents(input: string): number | null {
  const normalised = input.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  const cents = Math.round(Number(normalised) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Escapes a value for a CSV cell (and blocks spreadsheet formula injection). */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------------------------------------------------------------------
// Giving by bank transfer (docs/plans/eft-giving.md, migration #30)
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPES = ["cheque", "savings", "transmission", "business"] as const;
export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  cheque: "Cheque / current",
  savings: "Savings",
  transmission: "Transmission",
  business: "Business",
};

/**
 * A member's payment reference: the church's prefix + the first 6 characters
 * of their account id, upper-case ("KAMI-3F9A2C"). The database trigger
 * app_private.set_eft_reference (supabase/eft_giving.sql) builds the same
 * string when a transfer is recorded — keep the two identical.
 */
export function eftReference(prefix: string, userId: string): string {
  return `${prefix}-${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** A starting prefix from the church name: "KAMI Church" → "KAMI", "St Mark's" → "STMARKS". */
export function defaultReferencePrefix(churchName: string): string {
  const words = churchName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .split(/\s+/)
    .filter((w) => w && !["CHURCH", "THE", "OF", "AND"].includes(w));
  const joined = words.join("").slice(0, 8);
  if (joined.length >= 2) return joined;
  return "GIVE";
}

/** Church admin's bank details form (server-validated; the database checks the same rules). */
export const givingDetailsSchema = z.object({
  account_name: z.string().trim().min(2, "Enter the account holder's name.").max(100, "Keep it under 100 characters."),
  bank_name: z.string().trim().min(2, "Enter the bank's name.").max(60, "Keep it under 60 characters."),
  account_number: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6,16}$/, "Enter 6 to 16 digits — numbers only.")),
  branch_code: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Branch codes are 6 digits.")),
  account_type: z.enum(ACCOUNT_TYPES, { error: "Choose the account type." }),
  reference_prefix: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,8}$/, "Use 2 to 8 letters or numbers, no spaces.")),
});
export type GivingDetails = z.infer<typeof givingDetailsSchema>;

/** Member's "I've made a transfer" form. */
export function transferReportSchema(today: string) {
  return z.object({
    amount_cents: z
      .string()
      .transform((v) => randToCents(v))
      .refine((c): c is number => c !== null, "Enter an amount like 250 or 250.50.")
      .refine((c) => c !== null && c >= 100 && c <= MAX_GIFT_RAND * 100, `Enter an amount between R1 and R${MAX_GIFT_RAND.toLocaleString("en-ZA")}.`),
    fund: z.enum(GIVING_FUNDS, { error: "Choose a fund." }),
    paid_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date you paid.")
      .refine((d) => d <= today, "The date can't be in the future."),
  });
}

// ---------------------------------------------------------------------------
// Card giving (Paystack) — "add the card fee so my church gets the full gift"
// ---------------------------------------------------------------------------

export interface CardFeeRate {
  /** e.g. 2.9 for 2.9 % — copied from Paystack's pricing page into PAYSTACK_FEE_PERCENT. */
  percent: number;
  /** e.g. 100 for R1.00 — PAYSTACK_FEE_FLAT_CENTS. */
  flatCents: number;
}

/**
 * What to add so that, after Paystack takes `percent` % + flat of the TOTAL,
 * the church is left with the whole gift: total = (gift + flat) / (1 − p),
 * rounded up to the cent. Returns just the added amount.
 */
export function coverFeeCents(giftCents: number, rate: CardFeeRate): number {
  const p = rate.percent / 100;
  if (!(p >= 0 && p < 0.5) || rate.flatCents < 0) return 0;
  const total = Math.ceil((giftCents + rate.flatCents) / (1 - p));
  return total - giftCents;
}

/** The fee rate from the environment, or null when it isn't configured (then the option is hidden). */
export function cardFeeRateFromEnv(env: Record<string, string | undefined> = process.env): CardFeeRate | null {
  const percent = Number(env.PAYSTACK_FEE_PERCENT);
  const flatCents = Number(env.PAYSTACK_FEE_FLAT_CENTS ?? "0");
  if (!env.PAYSTACK_FEE_PERCENT || !Number.isFinite(percent) || percent <= 0 || percent >= 50) return null;
  if (!Number.isInteger(flatCents) || flatCents < 0) return null;
  return { percent, flatCents };
}

// ---------------------------------------------------------------------------
// Other ways to pay (giving_v2.sql): PayShap and the church's own payment link.
// ---------------------------------------------------------------------------

/** How a recorded (manually confirmed) gift was paid. */
export const GIVING_CHANNELS = ["bank", "payshap", "link"] as const;
export type GivingChannel = (typeof GIVING_CHANNELS)[number];

export function channelLabel(channel: string | null | undefined, linkLabel?: string | null): string {
  if (channel === "payshap") return "PayShap";
  if (channel === "link") return linkLabel || "Payment link";
  return "Bank transfer";
}

/** The church admin's PayShap ID and payment link. */
export const paymentOptionsSchema = z
  .object({
    payshap_id: z.string().trim().max(60, "Keep the PayShap ID to 60 characters.").transform((v) => v || null),
    link_label: z.string().trim().max(40, "Keep the name to 40 characters.").transform((v) => v || null),
    link_url: z
      .string()
      .trim()
      .max(500)
      .transform((v) => v || null)
      .refine((v) => v === null || /^https:\/\/\S{4,}$/.test(v), "Use the full link, starting with https://"),
  })
  .refine((v) => !v.payshap_id || v.payshap_id.length >= 3, { message: "That PayShap ID looks too short.", path: ["payshap_id"] })
  .refine((v) => !v.link_url || Boolean(v.link_label && v.link_label.length >= 2), { message: "Name the link, e.g. SnapScan.", path: ["link_label"] });
