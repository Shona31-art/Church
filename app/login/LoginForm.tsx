"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Only ever redirect back into the app — never to an arbitrary URL from the
// query string (open-redirect protection).
function safeNext(next: string | null) {
  return next && next.startsWith("/dashboard") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginForm({ expired, nextPath }: { expired: boolean; nextPath: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = safeNext(nextPath);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      // Supabase already rate-limits sign-in attempts; show a friendly message.
      setError(
        error.status === 429
          ? "Too many sign-in attempts. Please wait a minute and try again."
          : /not confirmed/i.test(error.message)
          ? "Please confirm your email first — check your inbox for the link we sent."
          : "That email and password don't match. Please try again."
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">Sign in</h1>
        <div className="rule-gold mx-auto" />

        {expired && (
          <p role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Your session expired, so you were signed out. Sign in again to pick up where you left off.
          </p>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-ink/20 rounded-lg px-4 py-3"
          />
        </div>
        <div className="text-right -mt-2">
          <Link href="/forgot-password" className="text-xs text-ember">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p role="alert" className="text-red-700 text-sm">
            ⚠ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ember text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-center text-sm text-ink/60">
          New church?{" "}
          <Link href="/register" className="text-ember">
            Start a free trial
          </Link>
        </p>
      </form>
    </main>
  );
}
