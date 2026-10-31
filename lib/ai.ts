import "server-only";
import { geminiApiKey } from "@/lib/ai-key";
import Anthropic from "@anthropic-ai/sdk";
import { extractJson } from "@/lib/json";

/**
 * The ONE place this app talks to an AI model. Every AI feature (sermon
 * analysis, prayer scripture, counseling, posters, quiz generation, Bible
 * study, announcement writer, prayer writer) goes through `generateText` /
 * `generateJson` so timeouts, model choice and error handling live here
 * instead of being copy-pasted per feature.
 *
 * Contract: these functions NEVER throw. They return `null` when AI is not
 * configured or the call fails, and every caller has a non-AI fallback, so
 * the app stays fully usable with zero API keys set.
 *
 * Providers: Anthropic Claude (ANTHROPIC_API_KEY) or Google Gemini
 * (GEMINI_API_KEY). If both are set, Claude is used.
 */

// Overridable so an operator can pick a cheaper model without a code change.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Short user-facing tasks: fail fast rather than leave someone staring at a
// spinner. One retry covers transient 429/5xx blips.
const TIMEOUT_MS = 30_000;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

export type AiProvider = "anthropic" | "gemini";

/** Why the most recent AI call on this server failed — shown by the admin "Test AI" button. */
let lastFailure: string | null = null;
export function lastAiFailure() {
  return lastFailure;
}

/** Which AI service answers, or null when no key is set. */
export function aiProvider(): AiProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (geminiApiKey()) return "gemini";
  return null;
}

export function isAiConfigured(): boolean {
  return aiProvider() !== null;
}

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export async function generateText(params: {
  prompt?: string;
  messages?: AiTurn[];
  system?: string;
  maxTokens?: number;
}): Promise<string | null> {
  const messages: AiTurn[] = params.messages ?? [{ role: "user", content: params.prompt ?? "" }];
  if (aiProvider() === "gemini") return generateWithGemini({ ...params, messages });

  const ai = getClient();
  if (!ai) return null;

  try {
    const response = await ai.beta.messages.create({
      model: MODEL,
      max_tokens: params.maxTokens ?? 2000,
      // Everything here is short-form writing, not hard reasoning — low
      // effort keeps latency and cost down without hurting quality.
      output_config: { effort: "low" },
      // If the primary model declines, the API re-runs the request on a
      // suitable fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(params.system ? { system: params.system } : {}),
      messages,
    });

    if (response.stop_reason === "refusal") return null;

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch (error) {
    // Log the real cause server-side; callers show a friendly fallback.
    if (error instanceof Anthropic.APIError) {
      console.error(`[ai] API error ${error.status}: ${error.message}`);
      lastFailure = `Anthropic answered ${error.status}: ${error.message.slice(0, 200)}`;
    } else {
      console.error("[ai] request failed:", error);
    }
    return null;
  }
}

/** Gemini request body (REST generateContent). Exported for tests. */
export function geminiRequestBody(params: { messages: AiTurn[]; system?: string; maxTokens?: number }, model = GEMINI_MODEL) {
  return {
    ...(params.system ? { systemInstruction: { parts: [{ text: params.system }] } } : {}),
    // Gemini calls the assistant "model".
    contents: params.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? 2000,
      // Short-form writing: keep thinking low (Gemini 3 and later), like Claude's effort "low" above.
      ...(/^gemini-[3-9]/.test(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** The answer text, or null when Gemini blocked or returned nothing. Exported for tests. */
export function geminiText(json: GeminiResponse): string | null {
  if (json.promptFeedback?.blockReason) return null;
  const candidate = json.candidates?.[0];
  if (!candidate || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION", "SPII"].includes(candidate.finishReason ?? "")) return null;
  const text = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return text || null;
}

async function generateWithGemini(params: { messages: AiTurn[]; system?: string; maxTokens?: number }): Promise<string | null> {
  const key = geminiApiKey();
  if (!key) return null;
  const url = `${GEMINI_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const body = JSON.stringify(geminiRequestBody(params));
  // One retry for transient 429/5xx blips, matching the Claude client.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as GeminiResponse;
        const text = geminiText(json);
        if (!text) lastFailure = `Google replied without text (${json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "empty answer"}).`;
        return text;
      }
      const detail = (await res.text()).slice(0, 300);
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) continue;
      console.error(`[ai] Gemini API error ${res.status} (model ${GEMINI_MODEL}${res.status === 404 ? " — check GEMINI_MODEL" : ""}): ${detail}`);
      lastFailure = `Google answered ${res.status}: ${detail.replace(/\s+/g, " ").slice(0, 200)}`;
      return null;
    } catch (error) {
      if (attempt === 0) continue;
      console.error("[ai] Gemini request failed:", error);
      lastFailure = `Couldn't reach Google: ${(error as Error)?.message ?? "network error"}`;
      return null;
    }
  }
  return null;
}

/** Asks for JSON and parses it (tolerant of ```json fences — see lib/json.ts). */
export async function generateJson<T>(params: {
  prompt: string;
  system?: string;
  maxTokens?: number;
}): Promise<T | null> {
  const text = await generateText(params);
  if (!text) return null;
  return extractJson<T>(text);
}
