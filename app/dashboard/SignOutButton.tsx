"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearOfflinePages } from "@/lib/bible/offline";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    // The offline copy of the Bible reader page includes the app header with
    // this person's name, so don't leave it on a shared device.
    await clearOfflinePages();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className={className}>
      Sign out
    </button>
  );
}
