// The Google Gemini API key, under the name GEMINI_API_KEY — or a close
// variation people often use by mistake (e.g. "GEMINI_API", "GOOGLE_API_KEY"),
// so AI still switches on. Server only: never prefix with NEXT_PUBLIC_.

const NAMES = ["GEMINI_API_KEY", "GEMINI_API", "GEMINI_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_API_KEY", "GEMINIAPIKEY", "Gemini_API_Key", "gemini_api_key"];

export function geminiApiKey(env: Record<string, string | undefined> = process.env): string | undefined {
  for (const name of NAMES) {
    const value = env[name]?.trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  return undefined;
}

/**
 * Optional free-tier Gemini key (a Google project WITHOUT billing), used for
 * the light, public writing jobs — announcements, prayer drafts, poster
 * wording, Bible study. Anything private (counselling) and all pictures use
 * the paid key. Server only.
 */
export function geminiFreeApiKey(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.GEMINI_FREE_API_KEY?.trim().replace(/^["']|["']$/g, "") || undefined;
}

/** Which name the key was found under (for the admin "Test AI" check). */
export function geminiKeyName(env: Record<string, string | undefined> = process.env): string | undefined {
  return NAMES.find((n) => env[n]?.trim());
}
