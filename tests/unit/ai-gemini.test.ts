import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { aiProvider, generateText, geminiRequestBody, geminiText } = await import("@/lib/ai");

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  vi.unstubAllGlobals();
});

describe("Gemini provider", () => {
  test("Claude wins when both keys are set; Gemini when it's the only one", () => {
    expect(aiProvider()).toBeNull();
    process.env.GEMINI_API_KEY = "g";
    expect(aiProvider()).toBe("gemini");
    process.env.ANTHROPIC_API_KEY = "a";
    expect(aiProvider()).toBe("anthropic");
  });

  test("maps the system prompt and conversation to Gemini's format", () => {
    const body = geminiRequestBody(
      { system: "Be kind.", messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }], maxTokens: 500 },
      "gemini-3.5-flash",
    );
    expect(body.systemInstruction).toEqual({ parts: [{ text: "Be kind." }] });
    expect(body.contents.map((c) => c.role)).toEqual(["user", "model"]);
    expect(body.generationConfig).toEqual({ maxOutputTokens: 500, thinkingConfig: { thinkingLevel: "low" } });
    // Older models don't take thinkingLevel.
    expect(geminiRequestBody({ messages: [] }, "gemini-2.5-flash").generationConfig).toEqual({ maxOutputTokens: 2000 });
  });

  test("reads the answer, skipping thoughts, and treats blocks as no answer", () => {
    expect(geminiText({ candidates: [{ content: { parts: [{ text: "plan", thought: true }, { text: " Grace " }] }, finishReason: "STOP" }] })).toBe("Grace");
    expect(geminiText({ candidates: [{ finishReason: "SAFETY" }] })).toBeNull();
    expect(geminiText({ promptFeedback: { blockReason: "OTHER" } })).toBeNull();
    expect(geminiText({})).toBeNull();
  });

  test("calls Gemini with the key in a header (never the URL), retries once, and never throws", async () => {
    process.env.GEMINI_API_KEY = "secret-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: "Amen" }] }, finishReason: "STOP" }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await generateText({ prompt: "Say amen" })).toBe("Amen");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/);
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await generateText({ prompt: "x" })).toBeNull();
    quiet.mockRestore();
  });
});

describe("Gemini key names", () => {
  test("finds the key under GEMINI_API_KEY or a common variation, quotes trimmed", async () => {
    const { geminiApiKey, geminiKeyName } = await import("@/lib/ai-key");
    expect(geminiApiKey({ GEMINI_API_KEY: "k1" })).toBe("k1");
    expect(geminiApiKey({ GEMINI_API: '"k2"' })).toBe("k2");
    expect(geminiApiKey({ GOOGLE_API_KEY: " k3 " })).toBe("k3");
    expect(geminiKeyName({ GEMINI_API: "x" })).toBe("GEMINI_API");
    expect(geminiApiKey({})).toBeUndefined();
  });
});
