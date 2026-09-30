"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { generateJson, isAiConfigured } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";

// Suggests 1-3 scripture references for a prayer. Uses the Anthropic API if
// ANTHROPIC_API_KEY is configured; otherwise falls back to simple keyword
// matching so the app still works out of the box with zero API keys set.
//
// NOTE ON TRANSLATIONS: only reference verses (e.g. "Jeremiah 29:11"), don't
// have the AI output full verse text of a copyrighted modern translation.
// If you want to *display* verse text, pair this with a public-domain
// translation (WEB/KJV) or a licensed Bible API — see counseling_schema.sql
// notes on the same issue.

const KEYWORD_MAP: Record<string, string[]> = {
  wisdom: ["Proverbs 3:5-6", "James 1:5"],
  career: ["Jeremiah 29:11", "Proverbs 16:3"],
  family: ["Joshua 24:15", "Psalm 127:1"],
  health: ["Jeremiah 17:14", "Psalm 41:3"],
  fear: ["Isaiah 41:10", "2 Timothy 1:7"],
  guidance: ["Proverbs 3:5-6", "Psalm 32:8"],
  strength: ["Philippians 4:13", "Isaiah 40:31"],
  peace: ["Philippians 4:6-7", "John 14:27"],
  gratitude: ["1 Thessalonians 5:18", "Psalm 100:4"],
};

export async function suggestScriptureForPrayer(prayerText: string): Promise<string[]> {
  const refs =
    isAiConfigured() && (await consumeAiQuota("prayer_scripture")).ok
      ? await generateJson<unknown>({
    maxTokens: 200,
    prompt: `A church member wrote this prayer: "${prayerText.slice(0, 2000)}"

Suggest 2-3 relevant Bible verse REFERENCES only (e.g. "Jeremiah 29:11"), not the verse text itself. Respond with ONLY a JSON array of strings, nothing else.`,
        })
      : null;
  if (Array.isArray(refs)) {
    const clean = refs.filter((r): r is string => typeof r === "string" && r.length < 40).slice(0, 3);
    if (clean.length) return clean;
  }

  const lower = prayerText.toLowerCase();
  for (const [keyword, refs] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) return refs;
  }
  return ["Philippians 4:6-7"]; // sensible default: a verse about bringing anything to God in prayer
}

export async function createPrayer(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Not signed in." };

  const prayerText = String(formData.get("prayer_text") || "").trim();
  const category = String(formData.get("category") || "").slice(0, 40);
  const shareOnWall = formData.get("share") === "on";
  if (!prayerText) return { error: "Write your prayer before saving." };
  if (prayerText.length > 4000) return { error: "That's a long prayer — please keep it under 4000 characters." };

  const scriptures = await suggestScriptureForPrayer(prayerText);

  const supabase = createClient();
  const { error } = await supabase.from("prayer_board_items").insert({
    user_id: me.id,
    church_id: me.church_id,
    prayer_text: prayerText,
    category,
    scripture_refs: scriptures,
    is_shared_request: shareOnWall,
  });

  if (error) {
    console.error("[prayer] save failed:", error.message);
    return { error: "Couldn't save your prayer — try again." };
  }

  redirect("/dashboard/prayer-board");
}
