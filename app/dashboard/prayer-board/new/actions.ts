"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";

export async function createPrayer(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Not signed in." };
  if (!(await checkModuleAccess("prayer_board")).allowed) return { error: "The prayer board isn't available on your church's plan." };

  const prayerText = String(formData.get("prayer_text") || "").trim();
  const category = String(formData.get("category") || "").slice(0, 40);
  const shareOnWall = formData.get("share") === "on";
  if (!prayerText) return { error: "Write your prayer before saving." };
  if (prayerText.length > 4000) return { error: "That's a long prayer — please keep it under 4000 characters." };

  const supabase = createClient();
  const { error } = await supabase.from("prayer_board_items").insert({
    user_id: me.id,
    church_id: me.church_id,
    prayer_text: prayerText,
    category,
    is_shared_request: shareOnWall,
  });

  if (error) {
    console.error("[prayer] save failed:", error.message);
    return { error: "Couldn't save your prayer — try again." };
  }

  // ?shared=1 lets the board offer notifications ("know when people pray for you").
  redirect(shareOnWall ? "/dashboard/prayer-board?shared=1" : "/dashboard/prayer-board");
}
