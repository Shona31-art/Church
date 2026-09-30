"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold mb-2">Check your email</h1>
          <p className="text-ink/60 text-sm">
            If an account exists for {email}, a password reset link is on its way.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center mb-2">Reset your password</h1>
        <p className="text-sm text-ink/50 text-center mb-4">
          Enter your email and we'll send you a reset link.
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ember text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        <p className="text-xs text-ink/40 text-center">
          <a href="/login" className="text-ember">
            Back to sign in
          </a>
        </p>
      </form>
    </main>
  );
}
