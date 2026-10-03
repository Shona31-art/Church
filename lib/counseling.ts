import "server-only";
import { detectCrisisSignal, SA_CRISIS_RESOURCES } from "@/lib/crisis-detection";
import { generateText, isAiConfigured } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";

// The AI counseling reply. Deliberately NOT a server action: an exported
// "use server" function is a public endpoint, and this one would let anyone
// use the church's AI budget as a general chatbot. Only the counseling
// actions (which check the member owns the conversation) call it.

export interface CounselingTurn {
  sender: "member" | "assistant";
  content: string;
}

export async function getCounselingReply(params: {
  history: CounselingTurn[];
  theologicalStance?: string | null;
}): Promise<{ reply: string; isCrisis: boolean }> {
  const lastMessage = params.history[params.history.length - 1]?.content ?? "";

  // Safety first, and without AI: crisis language gets real people and
  // helplines immediately, never a generated reply.
  if (detectCrisisSignal(lastMessage)) {
    return {
      isCrisis: true,
      reply: `I'm really glad you told me this, and I don't want you to face it alone. This is beyond what I can help with as an AI — please reach out to one of these right now:\n\n${SA_CRISIS_RESOURCES}\n\nI've also let one of your church's pastors know so they can reach out to you directly. You matter, and there are people ready to help.`,
    };
  }

  if (!isAiConfigured()) {
    return {
      isCrisis: false,
      reply: "AI replies aren't switched on for this app yet. You can share this conversation with a pastor, or request a pastor from Pastor Booking.",
    };
  }

  const quota = await consumeAiQuota("counseling");
  if (!quota.ok) return { isCrisis: false, reply: quota.error };

  const system = `You are a supportive Christian counseling assistant inside a church app. You are NOT a licensed therapist, NOT a substitute for pastoral care, and you must say so if asked directly what you are.

Rules:
- Keep responses warm, brief (3-6 sentences), and grounded in encouragement rather than clinical language.
- You may reference Bible verses by REFERENCE ONLY (e.g. "Psalm 34:18"), never quote the full verse text.
- Never attempt to diagnose a mental health condition.
- Never give medical, legal, or crisis-intervention advice yourself.
- ${params.theologicalStance ? `This church's theological stance/guidance: ${params.theologicalStance.slice(0, 1000)}` : "Keep responses broadly aligned with historic, mainstream Christian teaching rather than any one denomination's specific positions."}
- Gently encourage the person to also talk to their pastor or a trusted person in their life, especially for anything ongoing or serious.`;

  // Only the last 20 turns — keeps each request fast and cheap on long
  // conversations. The API requires the first turn to be the user's.
  const recent = params.history.slice(-20);
  while (recent.length && recent[0].sender !== "member") recent.shift();

  const text = await generateText({
    system,
    maxTokens: 800,
    messages: recent.map((m) => ({ role: m.sender === "member" ? ("user" as const) : ("assistant" as const), content: m.content.slice(0, 4000) })),
  });

  return {
    isCrisis: false,
    reply: text ?? "Something went wrong on my end — please try again in a moment, or share this conversation with a pastor.",
  };
}
