import { describe, expect, test } from "vitest";
import { MAX_ELEMENTS, PosterDesignSchema, assetPaths, blankDesign, type PosterDesign } from "@/lib/posters/design";

const ASSET = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";

function sample(): PosterDesign {
  return {
    ...blankDesign("square"),
    background: {
      color: "#101820",
      image: { src: { kind: "asset", assetId: ASSET, path: "church/user/bg.webp" }, overlay: { color: "#000000", opacity: 0.4 } },
    },
    elements: [
      { id: "title", type: "text", x: 80, y: 120, width: 920, height: 200, rotation: 0, opacity: 1, text: "Worship Night", fontFamily: "Playfair Display", fontSize: 120, fontWeight: 700, italic: false, fill: "#ffffff", align: "center", lineHeight: 1.1, letterSpacing: 0, uppercase: false },
      {
        id: "speaker-1",
        type: "group",
        role: "speaker",
        x: 300,
        y: 600,
        width: 480,
        height: 360,
        rotation: 0,
        opacity: 1,
        children: [
          { id: "speaker-1-photo", type: "image", x: 140, y: 0, width: 200, height: 200, rotation: 0, opacity: 1, src: { kind: "asset", assetId: ASSET, path: "church/user/pastor.webp" }, fit: "cover", shape: "circle", cornerRadius: 0 },
          { id: "speaker-1-name", type: "text", x: 0, y: 220, width: 480, height: 60, rotation: 0, opacity: 1, text: "Pastor Thabo", fontFamily: "Inter", fontSize: 44, fontWeight: 600, italic: false, fill: "#ffffff", align: "center", lineHeight: 1.2, letterSpacing: 0, uppercase: false },
        ],
      },
      { id: "photo", type: "image", x: 0, y: 0, width: 300, height: 300, rotation: 0, opacity: 1, src: { kind: "stock", provider: "pexels", url: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg", photographer: "Ann", photographerUrl: "https://www.pexels.com/@ann", pageUrl: "https://www.pexels.com/photo/1/" }, fit: "cover", shape: "rect", cornerRadius: 0 },
    ],
  };
}

describe("PosterDesignSchema", () => {
  test("accepts a real design and fills defaults", () => {
    const parsed = PosterDesignSchema.parse(sample());
    expect(parsed.elements).toHaveLength(3);
    const minimal = PosterDesignSchema.parse({
      ...blankDesign("story"),
      elements: [{ id: "s", type: "shape", shape: "rect", x: 0, y: 0, width: 10, height: 10, fill: "#ff0000" }],
    });
    expect(minimal.elements[0]).toMatchObject({ rotation: 0, opacity: 1, strokeWidth: 0 });
  });

  test("rejects outside image URLs and look-alike hosts", () => {
    const bad = sample();
    (bad.elements[2] as any).src.url = "https://evil.test/pexels.jpg";
    expect(PosterDesignSchema.safeParse(bad).success).toBe(false);
    (bad.elements[2] as any).src.url = "https://images.pexels.com.evil.test/x.jpg";
    expect(PosterDesignSchema.safeParse(bad).success).toBe(false);
    const raw = sample();
    (raw.elements[2] as any).src = { kind: "url", url: "javascript:alert(1)" };
    expect(PosterDesignSchema.safeParse(raw).success).toBe(false);
  });

  test("rejects sizes that don't match, bad colours, duplicate ids and too many elements", () => {
    expect(PosterDesignSchema.safeParse({ ...sample(), width: 999 }).success).toBe(false);
    const colour = sample();
    (colour.elements[0] as any).fill = "red";
    expect(PosterDesignSchema.safeParse(colour).success).toBe(false);
    const dupe = sample();
    (dupe.elements[1] as any).children[1].id = "title";
    expect(PosterDesignSchema.safeParse(dupe).success).toBe(false);
    const many = { ...blankDesign("square"), elements: Array.from({ length: MAX_ELEMENTS + 1 }, (_, i) => ({ id: `s${i}`, type: "shape", shape: "rect", x: 0, y: 0, width: 1, height: 1, fill: "#000000" })) };
    expect(PosterDesignSchema.safeParse(many).success).toBe(false);
  });

  test("no groups inside groups", () => {
    const nested = sample();
    (nested.elements[1] as any).children.push({ ...(nested.elements[1] as any), id: "inner" });
    expect(PosterDesignSchema.safeParse(nested).success).toBe(false);
  });
});

describe("assetPaths", () => {
  test("lists each uploaded photo once, from the background, elements and groups", () => {
    expect(assetPaths(PosterDesignSchema.parse(sample())).sort()).toEqual(["church/user/bg.webp", "church/user/pastor.webp"]);
    expect(assetPaths(blankDesign("a4"))).toEqual([]);
  });
});
