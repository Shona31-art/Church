"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog (also "Save as PDF"). Hidden when printing. */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-secondary print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden className="h-4 w-4" /> {label}
    </button>
  );
}
