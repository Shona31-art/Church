"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { provisionChurch } from "./actions";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    churchName: "",
    adminName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message || "Could not create your account.");
      return;
    }

    // If email confirmation is required (default on a fresh Supabase
    // project), there's no session yet — the church still gets provisioned,
    // but the admin needs to confirm their email before they can log in.
    const result = await provisionChurch({
      userId: data.user.id,
      churchName: form.churchName,
      adminName: form.adminName,
      email: form.email,
      phone: form.phone,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || "Something went wrong setting up your church.");
      return;
    }

    if (!data.session) {
      setNeedsEmailConfirm(true);
      return;
    }

    router.push("/dashboard/setup");
    router.refresh();
  }

  if (needsEmailConfirm) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-semibold mb-2">Almost there</h1>
          <p className="text-ink/60">
            Your church account has been created. Check your email to confirm
            your address, then sign in to get started.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center mb-6">
          Create your church account
        </h1>

        <input
          placeholder="Church name"
          required
          value={form.churchName}
          onChange={(e) => update("churchName", e.target.value)}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
        <input
          placeholder="Your name (admin)"
          required
          value={form.adminName}
          onChange={(e) => update("adminName", e.target.value)}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
        <input
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
        <input
          type="password"
          placeholder="Password"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ember text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Creating..." : "Start free trial"}
        </button>

        <p className="text-xs text-ink/40 text-center">
          30-day free trial, no card required. Already have an account?{" "}
          <a href="/login" className="text-ember">
            Sign in
          </a>
        </p>
      </form>
    </main>
  );
}
