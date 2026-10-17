"use server";

import { z } from "zod";
import { generateText } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";
import { checkModuleAccess } from "@/lib/paywall";
import { fetchVerse } from "@/lib/bible/text";

// Bible Study AI (ported from the Android Bible Assistant). Four modes.
// Scripture text shown to the user always comes from the World English Bible
// (public domain, self-hosted in public/bibles/ — lib/bible/text.ts) — the AI
// explains it, but never quotes copyrighted modern translations.

const MODES = {
  explain:
    "Explain this passage for a church member: 1) historical and literary context, 2) what it meant to its first readers, 3) key themes, 4) one or two practical applications for today. Around 300 words.",
  devotional:
    "Write a short daily devotional on this passage or topic: a one-line title, a 150-200 word reflection, and a two-sentence closing prayer.",
  cross_references:
    "List 5-7 related Bible passages. For each: the reference, then one sentence on how it connects. References only — do not quote verse text.",
  reading_plan:
    "Create a 7-day reading plan on this passage or topic. For each day: 'Day N — Reference — a short theme' and one reflection question.",
} as const;

export type StudyMode = keyof typeof MODES;

const InputSchema = z.object({
  query: z.string().trim().min(2, "Enter a passage (e.g. John 3:16) or a topic (e.g. forgiveness).").max(200, "Keep it under 200 characters."),
  mode: z.enum(Object.keys(MODES) as [StudyMode, ...StudyMode[]]),
});

// "John 3:16", "1 Cor 13:4-7", "Psalm 23" — looks like a reference rather than a topic.
const REFERENCE_PATTERN = /^\s*([1-3]\s*)?[A-Za-z][A-Za-z ]+\s+\d+(:\d+(-\d+)?)?\s*$/;

export async function runBibleStudy(
  query: string,
  mode: string
): Promise<{ text?: string; passageText?: string; error?: string }> {
  const access = await checkModuleAccess("bible_study_ai");
  if (!access.allowed) return { error: access.reason };

  const parsed = InputSchema.safeParse({ query, mode });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const quota = await consumeAiQuota("bible_study");
  if (!quota.ok) return { error: quota.error };

  const isReference = REFERENCE_PATTERN.test(parsed.data.query);
  const passageText = isReference ? await fetchVerse(parsed.data.query) : null;

  const text = await generateText({
    maxTokens: 1500,
    system:
      "You are a careful, warm Bible study assistant for a mainstream Christian church. Be faithful to the text and to historic Christian teaching; where Christians genuinely differ, say so briefly and even-handedly. Use plain language. Format with short paragraphs or simple numbered lists — no markdown headings, no tables. Never quote modern copyrighted translations; refer to verses by reference.",
    prompt: `${MODES[parsed.data.mode]}\n\n${isReference ? "Passage" : "Topic"}: ${parsed.data.query}${
      passageText ? `\n\nPassage text (World English Bible):\n${passageText.slice(0, 4000)}` : ""
    }`,
  });

  if (!text) return { error: "Bible study AI isn't available right now — please try again shortly.", passageText: passageText ?? undefined };
  return { text, passageText: passageText ?? undefined };
}
