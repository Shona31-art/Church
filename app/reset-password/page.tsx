"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/account-schemas";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";

// Landing page for invite and password-reset emails. The link signs the
// person in (Supabase puts the session in the URL), then they choose a password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
      if (sessionError) console.error("[reset-password]", sessionError.message);
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
    setError(null);
    const valid = passwordSchema.safeParse(password);
    if (!valid.success) return setError(valid.error.issues[0]?.message ?? "Choose a stronger password.");
    if (password !== confirm) return setError("The passwords don't match.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      console.error("[reset-password] update failed:", error.message);
      setError(/same/i.test(error.message) ? "Choose a password you haven't used before." : "We couldn't update your password. Request a new link and try again.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  const shell = (children: React.ReactNode) => <main className="min-h-screen flex items-center justify-center px-4 py-10">{children}</main>;

  if (done) return shell(<Alert tone="success">Password saved — taking you to your dashboard…</Alert>);
  if (checkingSession) return shell(<p className="text-ink/70" role="status">Checking your secure link…</p>);
  if (!hasSession) {
    return shell(
      <div className="card-elevated rounded-2xl p-8 max-w-sm text-center">
        <h1 className="text-xl font-semibold">This link has expired or was already used</h1>
        <p className="text-sm text-ink/70 mt-3">Links work once and expire after a while. Request a new one and open the latest email.</p>
        <Link href="/forgot-password" className="btn-primary mt-6">
          Request a new link
        </Link>
      </div>
    );
  }

  return shell(
    <form onSubmit={handleSubmit} className="w-full max-w-sm card-elevated rounded-2xl p-6 sm:p-8 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Choose your password</h1>
        <div className="rule-gold mx-auto mt-2" />
      </div>
      <FormField label="New password" htmlFor="password" required hint="At least 8 characters, with letters and numbers.">
        <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input" />
      </FormField>
      <FormField label="Confirm password" htmlFor="confirm" required>
        <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="input" />
      </FormField>
      {error && <Alert tone="error">{error}</Alert>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
