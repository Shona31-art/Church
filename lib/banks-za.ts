// South African banks as Paystack lists them (GET https://api.paystack.co/bank?country=south%20africa,
// snapshot 2026-10-19). `code` is what Paystack calls the bank code — for
// South African banks it's the bank's universal branch code — and is what a
// church's Paystack subaccount needs (`settlement_bank`).
// Refresh by calling that URL (public, no key) if a bank is missing.

export interface ZaBank {
  name: string;
  code: string;
}

export const ZA_BANKS: readonly ZaBank[] = [
  { name: "Absa Bank", code: "632005" },
  { name: "Access Bank South Africa", code: "410506" },
  { name: "African Bank", code: "430000" },
  { name: "African Business Bank", code: "584000" },
  { name: "Albaraka Bank", code: "800000" },
  { name: "Bank of China", code: "686000" },
  { name: "Bank Zero", code: "888000" },
  { name: "Bidvest Bank", code: "462005" },
  { name: "Capitec Bank", code: "470010" },
  { name: "Capitec Business", code: "450105" },
  { name: "CitiBank", code: "350005" },
  { name: "Discovery Bank", code: "679000" },
  { name: "Finbond EPE", code: "591000" },
  { name: "Finbond Mutual Bank", code: "589000" },
  { name: "First National Bank (FNB)", code: "250655" },
  { name: "FirstRand Bank", code: "201419" },
  { name: "GoTyme Bank", code: "678910" },
  { name: "HBZ Bank (Westville)", code: "570226" },
  { name: "HSBC South Africa", code: "587000" },
  { name: "Investec Bank", code: "580105" },
  { name: "JP Morgan South Africa", code: "432000" },
  { name: "Nedbank", code: "198765" },
  { name: "Olympus Mobile", code: "585001" },
  { name: "OM Bank", code: "352000" },
  { name: "Rand Merchant Bank", code: "261251" },
  { name: "RMB Private Bank", code: "222026" },
  { name: "SASFIN Bank", code: "683000" },
  { name: "Société Générale South Africa", code: "351005" },
  { name: "South African Bank of Athens", code: "410105" },
  { name: "Standard Bank", code: "051001" },
  { name: "Standard Chartered Bank", code: "730020" },
  { name: "Ubank", code: "431010" },
  { name: "VBS Mutual Bank", code: "588000" },
];

/** The Paystack bank for a branch code, if it's one of the universal codes above. */
export function bankForBranchCode(branchCode: string): ZaBank | undefined {
  return ZA_BANKS.find((b) => b.code === branchCode.trim());
}
