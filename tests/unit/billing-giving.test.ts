import { describe, expect, test } from "vitest";
import { planForStripeStatus } from "@/lib/billing";
import { csvCell, randToCents } from "@/lib/giving";
import { isDirectMediaFile, isSafeHttpUrl, youtubeEmbedUrl } from "@/lib/media";

describe("Stripe subscription status → church access", () => {
  test("paying churches stay active", () => {
    expect(planForStripeStatus("active")).toBe("active");
    expect(planForStripeStatus("trialing")).toBe("active");
  });
  test("failed payments give a grace period, not an instant lock-out", () => {
    expect(planForStripeStatus("past_due")).toBe("grace");
    expect(planForStripeStatus("unpaid")).toBe("grace");
  });
  test("cancelled subscriptions suspend access", () => {
    expect(planForStripeStatus("canceled")).toBe("suspended");
  });
  test("an unknown future status changes nothing", () => {
    expect(planForStripeStatus("something_new")).toBeNull();
  });
});

describe("gift amounts", () => {
  test("accepts rand with optional cents, in either decimal style", () => {
    expect(randToCents("250")).toBe(25000);
    expect(randToCents("250.5")).toBe(25050);
    expect(randToCents("1 250,50")).toBe(125050);
  });
  test("rejects nonsense", () => {
    expect(randToCents("-5")).toBeNull();
    expect(randToCents("1e9")).toBeNull();
    expect(randToCents("12.345")).toBeNull();
    expect(randToCents("")).toBeNull();
  });
});

describe("CSV export safety", () => {
  test("quotes commas and quotes", () => {
    expect(csvCell('Smith, "Jo"')).toBe('"Smith, ""Jo"""');
  });
  test("neutralises spreadsheet formulas in donor names", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toMatch(/^"?'=/);
    expect(csvCell("+27 82")).toBe("'+27 82");
  });
});

describe("sermon media links", () => {
  test("YouTube links become privacy-enhanced embeds", () => {
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeEmbedUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
  test("other links aren't embedded", () => {
    expect(youtubeEmbedUrl("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeEmbedUrl("javascript:alert(1)")).toBeNull();
  });
  test("only http(s) links are ever rendered", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("https://church.example/sermon.mp3")).toBe(true);
    expect(isDirectMediaFile("https://church.example/sermon.mp3")).toBe(true);
    expect(isDirectMediaFile("https://church.example/watch")).toBe(false);
  });
});
