"use server";

import { detectCrisisSignal, SA_CRISIS_RESOURCES } from "@/lib/crisis-detection";
import { generateText, isAiConfigured } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";

// Crisis detection logic itself now lives in lib/crisis-detection.ts —
// a "use server" file can only export async functions, and the detector
// is synchronous, so it can't live in this file directly.

export async function getCounselingReply(params: {
  history: { sender: "member" | "assistant"; content: string }[];
  theologicalStance?: string | null;
  bibleTranslation?: string;
}): Promise<{ reply: string; isCrisis: boolean }> {
  const lastMessage = params.history[params.history.length - 1]?.content ?? "";
  const isCrisis = detectCrisisSignal(lastMessage);

  if (isCrisis) {
    return {
      isCrisis: true,
      reply: `I'm really glad you told me this, and I don't want you to face it alone. This is beyond what I can help with as an AI — please reach out to one of these right now:\n\n${SA_CRISIS_RESOURCES}\n\nI've also let one of your church's pastors know so they can reach out to you directly. You matter, and there are people ready to help.`,
    };
  }

  if (!isAiConfigured()) {
    return {
      isCrisis: false,
      reply:
        "(AI counseling isn't configured yet — set ANTHROPIC_API_KEY to enable responses. In the meantime, consider using 'Request Pastor' for support.)",
    };
  }

  const systemPrompt = `You are a supportive Christian counseling assistant inside a church app. You are NOT a licensed therapist, NOT a substitute for pastoral care, and you must say so if asked directly what you are.

Rules:
- Keep responses warm, brief (3-6 sentences), and grounded in encouragement rather than clinical language.
- You may reference Bible verses by REFERENCE ONLY (e.g. "Psalm 34:18"), never quote the full verse text, since translations are copyrighted.
- Never attempt to diagnose a mental health condition.
- Never give medical, legal, or crisis-intervention advice yourself — if the person describes anything resembling danger to themselves or others, abuse, or crisis, this is handled by a separate safety system before your response is ever generated, so you will not see those messages.
- ${params.theologicalStance ? `This church's theological stance/guidance: ${params.theologicalStance}` : "Keep responses broadly aligned with historic, mainstream Christian teaching rather than any one denomination's specific positions."}
- Gently encourage the person to also talk to their pastor or a trusted person in their life, especially for anything ongoing or serious — you are a supplement, not their only support.`;

  const quota = await consumeAiQuota("counseling");
  if (!quota.ok) return { isCrisis: false, reply: quota.error };

  // Only the last 20 turns — keeps each request fast/cheap and within limits
  // on long-running conversations. The API requires the first turn be "user".
  const recent = params.history.slice(-20);
  while (recent.length && recent[0].sender !== "member") recent.shift();

  const text = await generateText({
    system: systemPrompt,
    maxTokens: 800,
    messages: recent.map((m) => ({
      role: m.sender === "member" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  });

  return {
    isCrisis: false,
    reply: text ?? "Something went wrong on my end — please try again in a moment, or use 'Request Pastor'.",
  };
}
