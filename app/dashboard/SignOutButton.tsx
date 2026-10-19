"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearOfflinePages } from "@/lib/bible/offline";
import { showToast } from "@/components/ui/Toaster";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    // If the sign-out request fails (e.g. offline), Supabase keeps the
    // session — so say so instead of showing the login page while the person
    // is in fact still signed in.
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[sign-out]", error.message);
      setPending(false);
      showToast("We couldn't sign you out. Check your internet connection and try again.", "error");
      return;
    }
    // The offline copy of the Bible reader page includes the app header with
    // this person's name, so don't leave it on a shared device.
    await clearOfflinePages();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={pending} aria-busy={pending} className={className}>
      <LogOut aria-hidden className="h-3.5 w-3.5" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
