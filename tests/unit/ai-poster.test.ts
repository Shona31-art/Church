import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { posterPrompt, posterRequestBody, posterFromResponse } = await import("@/lib/ai-image");

describe("AI poster request", () => {
  test("asks for a finished poster with the person's exact wording, size and photos", () => {
    const prompt = posterPrompt({ description: "Youth night Friday 7pm, Pastor James", churchName: "Kingdom Awakening Ministries", size: "story", photoCount: 2, hasLogo: true });
    expect(prompt).toContain("Kingdom Awakening Ministries");
    expect(prompt).toContain("Youth night Friday 7pm, Pastor James");
    expect(prompt).toContain("9:16");
    expect(prompt).toMatch(/spelled exactly/);
    expect(prompt).toMatch(/Don't invent dates/);
    expect(prompt).toContain("2 supplied photo(s)");
    expect(prompt).toMatch(/last image is the church's logo/);
  });

  test("a change request edits the existing poster", () => {
    const prompt = posterPrompt({ description: "x", churchName: "C", size: "square", photoCount: 0, hasLogo: false, refine: "make the title bigger" });
    expect(prompt).toMatch(/^Here is a church event poster you designed/);
    expect(prompt).toContain("make the title bigger");
  });

  test("sends text then images, and asks for an image back at the right aspect ratio", () => {
    const body = posterRequestBody("hello", [{ mimeType: "image/jpeg", data: "AAA" }], "portrait");
    expect(body.contents[0].parts).toEqual([{ text: "hello" }, { inlineData: { mimeType: "image/jpeg", data: "AAA" } }]);
    expect(body.generationConfig.responseModalities).toContain("IMAGE");
    expect(body.generationConfig.imageConfig.aspectRatio).toBe("4:5");
  });
});

describe("AI poster reply", () => {
  test("returns the image", () => {
    const r = posterFromResponse({ candidates: [{ content: { parts: [{ text: "Here you go" }, { inlineData: { mimeType: "image/png", data: "PNG" } }] } }] });
    expect(r).toEqual({ image: { mimeType: "image/png", data: "PNG" } });
  });

  test("explains a blocked or empty reply instead of failing silently", () => {
    expect(posterFromResponse({ promptFeedback: { blockReason: "SAFETY" } })).toHaveProperty("error");
    expect(posterFromResponse({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] })).toHaveProperty("error");
    expect(posterFromResponse({ candidates: [{ content: { parts: [{ text: "I can't" }] } }] })).toHaveProperty("error");
    expect(posterFromResponse({})).toHaveProperty("error");
  });
});
