"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";

/**
 * The church's bank details, with a copy button on each value people type
 * into their banking app. The personal reference is the one thing that must
 * be exact, so it's set apart.
 */
export function BankDetails({
  rows,
  reference,
  lastChanged,
}: {
  rows: { label: string; value: string; copy?: boolean }[];
  reference: string;
  lastChanged: string;
}) {
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-line rounded-xl border border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs text-ink/60">{r.label}</dt>
            <dd className="flex min-w-0 items-center gap-1 text-right text-sm font-medium">
              <span className={`truncate ${r.copy ? "tabular" : ""}`}>{r.value}</span>
              {r.copy && <CopyButton value={r.value} label={r.label} />}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/50 bg-gold/[0.07] px-4 py-3">
        <div className="min-w-0">
          <p className="eyebrow">Your reference</p>
          <p className="tabular mt-1 text-lg font-semibold tracking-wide">{reference}</p>
          <p className="mt-0.5 text-xs text-ink/60">Use this every time, so your church knows the gift is from you.</p>
        </div>
        <CopyButton value={reference} label="reference" prominent />
      </div>

      <p className="text-xs text-ink/60">{lastChanged} If these details ever change unexpectedly, check with your church before paying.</p>
    </div>
  );
}

function CopyButton({ value, label, prominent = false }: { value: string; label: string; prominent?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(`Couldn't copy — select the ${label.toLowerCase()} and copy it by hand.`, "error");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      className={prominent ? "btn-secondary btn-sm shrink-0" : "btn-ghost btn-icon h-8 w-8 shrink-0"}
    >
      {copied ? <Check aria-hidden className="h-3.5 w-3.5 text-success" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
      {prominent && (copied ? "Copied" : "Copy")}
    </button>
  );
}
