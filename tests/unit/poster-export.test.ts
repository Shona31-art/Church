import { describe, expect, it } from "vitest";
import {
  animateAll,
  centredScaleOffset,
  clearAnimations,
  ENTRANCE_SECONDS,
  frameState,
  MAX_VIDEO_SECONDS,
  MIN_VIDEO_SECONDS,
  pickVideoType,
  videoSeconds,
  videoSize,
} from "@/lib/posters/animation";
import { blankDesign, PosterDesignSchema } from "@/lib/posters/design";
import { jpegSize, jpegToPdf, pdfPageSize } from "@/lib/posters/pdf";

describe("poster animation timing", () => {
  it("leaves elements without an animation at rest", () => {
    expect(frameState(undefined, 0, 80)).toEqual({ opacity: 1, dx: 0, dy: 0, scale: 1 });
    expect(frameState({ entrance: "none", delay: 0 }, 0, 80).opacity).toBe(1);
  });

  it("is hidden before its delay and at rest after its entrance", () => {
    const anim = { entrance: "slide-up" as const, delay: 1 };
    expect(frameState(anim, 0.5, 80)).toMatchObject({ opacity: 0, dy: 80 });
    expect(frameState(anim, 1 + ENTRANCE_SECONDS, 80)).toEqual({ opacity: 1, dx: 0, dy: 0, scale: 1 });
  });

  it("moves slides from the correct side", () => {
    expect(frameState({ entrance: "slide-left", delay: 0 }, 0.1, 80).dx).toBeLessThan(0);
    expect(frameState({ entrance: "slide-right", delay: 0 }, 0.1, 80).dx).toBeGreaterThan(0);
  });

  it("keeps the video between 6 and 10 seconds", () => {
    expect(videoSeconds([])).toBe(MIN_VIDEO_SECONDS);
    expect(videoSeconds([{ entrance: "fade", delay: 5 }])).toBeCloseTo(5 + ENTRANCE_SECONDS + 2.5, 5);
    expect(videoSeconds([{ entrance: "fade", delay: 5 }, { entrance: "pop", delay: 5 }])).toBeLessThanOrEqual(MAX_VIDEO_SECONDS);
  });

  it("animates everything top to bottom, and the result still validates", () => {
    const design = blankDesign("story");
    const elements: { id: string; type: string; y: number; height: number; animation?: { entrance: "fade"; delay: number } }[] = [
      { id: "b", type: "text", y: 900, height: 100 },
      { id: "a", type: "text", y: 100, height: 100 },
      { id: "bg", type: "shape", y: 0, height: design.height },
    ];
    const animated = animateAll(elements, design.height);
    const byId = Object.fromEntries(animated.map((e) => [e.id, e.animation]));
    expect(byId.a!.delay).toBeLessThan(byId.b!.delay);
    expect(byId.bg).toEqual({ entrance: "fade", delay: 0 });
    expect(clearAnimations(animated).every((e) => !("animation" in e))).toBe(true);
  });

  it("accepts saved designs with and without animation", () => {
    const design = blankDesign("square");
    const text = { id: "t1", type: "text", x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, text: "Hi", fontFamily: "Inter", fontSize: 40, fontWeight: 400, fill: "#000000" };
    expect(PosterDesignSchema.safeParse({ ...design, elements: [text] }).success).toBe(true);
    expect(PosterDesignSchema.safeParse({ ...design, elements: [{ ...text, animation: { entrance: "pop", delay: 1 } }] }).success).toBe(true);
    expect(PosterDesignSchema.safeParse({ ...design, elements: [{ ...text, animation: { entrance: "spin", delay: 1 } }] }).success).toBe(false);
  });

  it("scales around the centre", () => {
    expect(centredScaleOffset(100, 50, 0, 0.5)).toEqual({ dx: 25, dy: 12.5 });
    expect(centredScaleOffset(100, 50, 0, 1)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("video size and format", () => {
  it("caps at full HD with even dimensions, and halves for low memory", () => {
    expect(videoSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
    const a4 = videoSize(2480, 3508);
    expect(a4.height).toBeLessThanOrEqual(1920);
    expect(a4.width).toBeLessThanOrEqual(1080);
    expect(a4.width % 2 + a4.height % 2).toBe(0);
    expect(videoSize(1080, 1920, true)).toEqual({ width: 720, height: 1280 });
  });

  it("prefers MP4 and falls back to WebM", () => {
    expect(pickVideoType(() => true)?.extension).toBe("mp4");
    expect(pickVideoType((t) => t.startsWith("video/webm"))?.extension).toBe("webm");
    expect(pickVideoType(() => false)).toBeNull();
  });
});

describe("poster PDF", () => {
  // SOI, an APP0 segment (length 4), a SOF0 header for 1081 × 1079, EOI.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x37, 0x04, 0x39, 0x03, 0xff, 0xd9]);

  it("reads the real pixel size from the JPEG", () => {
    expect(jpegSize(jpeg)).toEqual({ width: 1081, height: 1079 });
    expect(() => jpegSize(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it("uses a true A4 page for A4 posters and 96 dpi otherwise", () => {
    expect(pdfPageSize("a4", 2480, 3508)).toEqual({ width: 595.28, height: 841.89 });
    expect(pdfPageSize("square", 1080, 1080)).toEqual({ width: 810, height: 810 });
  });

  it("writes a well-formed single-page PDF with a correct cross-reference table", () => {
    const pdf = jpegToPdf(jpeg, { width: 810, height: 810 }, "Easter (Sunday)");
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Width 1081 /Height 1079");
    expect(text).toContain(`/Filter /DCTDecode /Length ${jpeg.length}`);
    expect(text).toContain("/Title (Easter \\(Sunday\\))");

    // Every xref offset must point at the start of its object.
    const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(6);
    offsets.forEach((offset, i) => expect(text.slice(offset, offset + 8)).toBe(`${i + 1} 0 obj\n`));
  });
});
