"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";

// Only ever redirect back into the app — never to an arbitrary URL from the
// query string (open-redirect protection).
function safeNext(next: string | null) {
  return next && next.startsWith("/dashboard") && !next.startsWith("//") && !next.includes("\\") ? next : "/dashboard";
}

const REASON_MESSAGES: Record<string, { tone: "warning" | "error"; text: string }> = {
  disabled: {
    tone: "error",
    text: "This account has been deactivated by your church. If you think this is a mistake, contact your church office.",
  },
  no_profile: {
    tone: "warning",
    text: "Your sign-in worked, but it isn't linked to a church yet. Ask your church admin to invite you, or start a free trial for a new church.",
  },
};

export function LoginForm({ expired, nextPath, reason }: { expired: boolean; nextPath: string | null; reason: string | null }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = safeNext(nextPath);
  const reasonMessage = reason ? REASON_MESSAGES[reason] : undefined;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setLoading(false);
      // Supabase already rate-limits sign-in attempts; show a friendly message.
      setError(
        error.status === 429
          ? "Too many sign-in attempts. Please wait a minute and try again."
          : /not confirmed/i.test(error.message)
          ? "Please confirm your email first — check your inbox for the link we sent."
          : /fetch|network/i.test(error.message)
          ? "We couldn't reach the server. Check your internet connection and try again."
          : "That email and password don't match. Please try again."
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <form onSubmit={handleLogin} className="w-full max-w-sm card-elevated rounded-2xl p-6 sm:p-8 space-y-4" noValidate={false}>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <div className="rule-gold mx-auto mt-2" />
        </div>

        {expired && (
          <Alert tone="warning">Your session expired, so you were signed out. Sign in again to pick up where you left off.</Alert>
        )}
        {reasonMessage && <Alert tone={reasonMessage.tone}>{reasonMessage.text}</Alert>}

        <FormField label="Email" htmlFor="email" required>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
        </FormField>
        <FormField label="Password" htmlFor="password" required>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </FormField>
        <div className="text-right -mt-2">
          <Link href="/forgot-password" className="text-xs link">
            Forgot password?
          </Link>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-ink/60">
          New church?{" "}
          <Link href="/register" className="link">
            Start a free trial
          </Link>
        </p>
      </form>
    </main>
  );
}
