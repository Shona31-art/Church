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
