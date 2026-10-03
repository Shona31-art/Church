"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    // Supabase rate-limits these emails. Any other outcome shows the same
    // message, so the page can't be used to check who has an account.
    if (error?.status === 429) {
      setError("Too many requests. Please wait a minute and try again.");
      return;
    }
    if (error) console.error("[forgot-password]", error.message);
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      {sent ? (
        <div className="card-elevated rounded-2xl p-8 max-w-sm text-center" role="status">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-ink/70 text-sm mt-3">If an account exists for {email}, a link to reset your password is on its way. It can take a few minutes.</p>
          <Link href="/login" className="btn-secondary mt-6">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm card-elevated rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <div className="rule-gold mx-auto mt-2" />
            <p className="text-sm text-ink/60 mt-3">Enter your email and we&apos;ll send you a link to choose a new password.</p>
          </div>
          <FormField label="Email" htmlFor="email" required>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" />
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-center text-sm">
            <Link href="/login" className="link">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
