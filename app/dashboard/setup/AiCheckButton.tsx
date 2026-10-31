"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { testAiConnection, type AiCheck } from "./actions";
import { Alert } from "@/components/ui/Alert";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

/** "Test AI": what the live site sees, in plain words. */
export function AiCheckButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiCheck | null>(null);

  async function run() {
    setBusy(true);
    const r = await callAction(() => testAiConnection(), { provider: null, model: null, onPlan: false, ok: false, message: CONNECTION_FAILED } as AiCheck);
    setResult(r);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={run} disabled={busy} className="btn-secondary">
        <Sparkles aria-hidden className="h-4 w-4" /> {busy ? "Testing…" : "Test AI"}
      </button>
      {result && (
        <Alert tone={result.ok ? (result.onPlan ? "success" : "warning") : "error"}>
          <p>{result.message}</p>
          {result.provider && (
            <p className="mt-1 text-xs opacity-80">
              Using {result.provider === "gemini" ? "Google Gemini" : "Anthropic Claude"} ({result.model}). AI on your plan: {result.onPlan ? "yes" : "no"}.
            </p>
          )}
        </Alert>
      )}
    </div>
  );
}
