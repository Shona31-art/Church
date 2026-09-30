"use server";

import { generateJson } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";

// Generates a summary, scripture references, discussion questions, and
// prayer points from a sermon transcript. Requires ANTHROPIC_API_KEY — if
// it's not set, returns empty AI fields and the sermon still saves fine
// (pastor can add these manually, or come back once the key is configured).

export interface SermonAnalysis {
  summary: string;
  scriptureRefs: string[];
  discussionQuestions: string[];
  prayerPoints: string[];
}

export async function analyzeSermonTranscript(transcript: string): Promise<SermonAnalysis> {
  const empty: SermonAnalysis = {
    summary: "",
    scriptureRefs: [],
    discussionQuestions: [],
    prayerPoints: [],
  };

  if (!transcript.trim()) return empty;
  if (!(await consumeAiQuota("sermon_analysis")).ok) return empty;

  const parsed = await generateJson<Partial<SermonAnalysis>>({
    maxTokens: 1500,
    prompt: `Here is a sermon transcript:

${transcript}

Respond with ONLY valid JSON, no other text, in this exact shape:
{"summary": "2-3 sentence summary", "scriptureRefs": ["Book Chapter:Verse", ...up to 5], "discussionQuestions": ["...", ...3-5 questions for small groups], "prayerPoints": ["...", ...3-5 short prayer points]}

For scriptureRefs, give references only (e.g. "Romans 8:28"), never the verse text itself.`,
  });
  if (!parsed) return empty;

  return {
    summary: parsed.summary || "",
    scriptureRefs: parsed.scriptureRefs || [],
    discussionQuestions: parsed.discussionQuestions || [],
    prayerPoints: parsed.prayerPoints || [],
  };
}
