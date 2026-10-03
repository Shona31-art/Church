"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
      if (sessionError) setError(`Could not verify this link: ${sessionError.message}`);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-ink/70">Password updated — taking you to your dashboard...</p>
      </main>
    );
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-ink/70">Verifying your secure link...</p>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">This link is invalid or expired</h1>
          {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
          <p className="text-sm text-ink/60">
            Request a new password setup or reset email, then open its latest link.
          </p>
          <Link href="/forgot-password" className="inline-block text-ember">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center mb-6">Set your password</h1>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ember text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </main>
  );
}
