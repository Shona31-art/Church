import "server-only";
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
 */

// Overridable so an operator can pick a cheaper model without a code change.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

// Short user-facing tasks: fail fast rather than leave someone staring at a
// spinner. One retry covers transient 429/5xx blips.
const TIMEOUT_MS = 30_000;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
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
  const ai = getClient();
  if (!ai) return null;

  const messages: AiTurn[] = params.messages ?? [{ role: "user", content: params.prompt ?? "" }];

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
    } else {
      console.error("[ai] request failed:", error);
    }
    return null;
  }
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
