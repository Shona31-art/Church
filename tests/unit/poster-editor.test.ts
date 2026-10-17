import { describe, expect, test } from "vitest";
import { HISTORY_LIMIT, createHistory, record, recordCoalesced, redo, replacePresent, undo } from "@/lib/posters/history";
import {
  addElement,
  applyResize,
  createShape,
  createText,
  duplicateElement,
  luminance,
  reorderElement,
  removeElement,
  updateElement,
} from "@/lib/posters/elements";
import { PosterDesignSchema, blankDesign } from "@/lib/posters/design";

describe("history", () => {
  test("undo and redo walk back and forth; a new change clears redo", () => {
    let h = createHistory(1);
    h = record(h, 2);
    h = record(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = redo(h);
    expect(h.present).toBe(3);
    h = undo(undo(h));
    expect(h.present).toBe(1);
    h = record(h, 9);
    expect(h.future).toEqual([]);
    expect(redo(h).present).toBe(9);
  });

  test("undo at the start and redo at the end do nothing; typing doesn't add steps", () => {
    const h = createHistory("a");
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    const typed = replacePresent(record(h, "ab"), "abc");
    expect(typed.past).toEqual(["a"]);
    expect(undo(typed).present).toBe("a");
  });

  test("quick changes of the same kind merge into one undo step; others don't", () => {
    let h = createHistory("");
    let last = { key: "", at: 0 };
    for (const [value, key, at] of [["H", "t:text", 1000], ["He", "t:text", 1300], ["Hey", "t:text", 1600], ["Hey!", "t:fill", 1700], ["Hey!!", "t:text", 4000]] as const) {
      h = recordCoalesced(h, value, key, last, at);
      last = { key, at };
    }
    expect(h.past).toEqual(["", "Hey", "Hey!"]);
    expect(undo(h).present).toBe("Hey!");
  });

  test("keeps at most the last HISTORY_LIMIT steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) h = record(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("element operations", () => {
  const base = blankDesign("square");

  test("new text and shapes are valid, centred and readable on the background", () => {
    const text = createText(base, "heading", "Manrope");
    expect(text.fill).toBe("#14161a"); // dark text on a white poster
    expect(createText({ ...base, background: { color: "#101820" } }, "heading", "Manrope").fill).toBe("#ffffff");
    const design = addElement(addElement(base, text), createShape(base, "ellipse"));
    expect(PosterDesignSchema.safeParse(design).success).toBe(true);
    expect(text.x + text.width / 2).toBe(540);
  });

  test("update, duplicate, reorder and remove", () => {
    const a = createShape(base, "rect");
    const b = createShape(base, "line");
    let d = addElement(addElement(base, a), b);
    d = updateElement(d, a.id, { opacity: 0.5, type: "text" } as never);
    expect(d.elements[0]).toMatchObject({ opacity: 0.5, type: "shape" }); // type can't change
    const dup = duplicateElement(d, a.id);
    expect(dup.design.elements).toHaveLength(3);
    expect(dup.design.elements[2]).toMatchObject({ x: a.x + 32, y: a.y + 32, opacity: 0.5 });
    expect(dup.newId).not.toBe(a.id);
    d = reorderElement(dup.design, a.id, "front");
    expect(d.elements[2].id).toBe(a.id);
    expect(reorderElement(d, a.id, "forward")).toBe(d); // already on top
    d = reorderElement(d, a.id, "back");
    expect(d.elements[0].id).toBe(a.id);
    expect(removeElement(d, a.id).elements.map((e) => e.id)).not.toContain(a.id);
  });

  test("resizing text: corners scale the font, sides re-wrap", () => {
    const text = createText(base, "body", "Manrope");
    const corner = applyResize(text, 2, 2) as { fontSize: number; width: number };
    expect(corner.fontSize).toBeCloseTo(text.fontSize * 2, 0);
    const side = applyResize(text, 1.5, 1) as { fontSize?: number; width: number };
    expect(side.fontSize).toBeUndefined();
    expect(side.width).toBe(Math.round(text.width * 1.5));
    expect(applyResize(createShape(base, "rect"), 0.001, 0.001)).toEqual({ width: 5, height: 5 });
  });

  test("luminance", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("#000000")).toBe(0);
  });
});

describe("templates and resizing", () => {
  test("every template is a valid design at every size, and resizing keeps it valid", async () => {
    const { POSTER_TEMPLATES, templateDesign } = await import("@/lib/posters/templates");
    const { POSTER_SIZE_KEYS } = await import("@/lib/posters/design");
    for (const t of POSTER_TEMPLATES) {
      for (const size of POSTER_SIZE_KEYS) {
        const result = PosterDesignSchema.safeParse(templateDesign(t.key, size));
        expect(result.success, `${t.key} @ ${size}: ${result.success ? "" : result.error.issues[0]?.message}`).toBe(true);
      }
    }
  });

  test("resizing to a taller poster keeps things centred and unstretched", async () => {
    const { resizeDesign } = await import("@/lib/posters/layout");
    const square = addElement(blankDesign("square"), { ...createText(blankDesign("square"), "heading", "Manrope"), x: 140, width: 800 });
    const story = resizeDesign(square, "story");
    const [text] = story.elements as [ReturnType<typeof createText>];
    expect(story.height).toBe(1920);
    expect(text.x + text.width / 2).toBe(540); // still centred horizontally
    expect(text.fontSize).toBe((square.elements[0] as ReturnType<typeof createText>).fontSize); // width ratio is 1, so no change
    expect(resizeDesign(square, "square")).toBe(square);
  });

  test("unknown templates fall back to a blank design", async () => {
    const { templateDesign } = await import("@/lib/posters/templates");
    expect(templateDesign("nope", "a4")).toEqual(blankDesign("a4"));
  });
});

describe("template quality", () => {
  test("16 templates, each using only bundled fonts, with every text box on the poster at every size", async () => {
    const { POSTER_TEMPLATES, templateDesign } = await import("@/lib/posters/templates");
    const { POSTER_FONTS } = await import("@/lib/posters/fonts");
    const { POSTER_SIZE_KEYS } = await import("@/lib/posters/design");
    const fonts = new Set(POSTER_FONTS.map((f) => f.name));
    expect(POSTER_TEMPLATES).toHaveLength(16);
    expect(new Set(POSTER_TEMPLATES.map((t) => t.key)).size).toBe(16);
    const problems: string[] = [];
    for (const t of POSTER_TEMPLATES) {
      for (const size of POSTER_SIZE_KEYS) {
        const d = templateDesign(t.key, size);
        for (const e of d.elements) {
          if (e.type !== "text") continue;
          if (!fonts.has(e.fontFamily)) problems.push(`${t.key}: unknown font ${e.fontFamily}`);
          if (e.x < 0 || e.x + e.width > d.width + 1) problems.push(`${t.key}@${size}: "${e.name}" runs off the side`);
          if (e.y < 0 || e.y + e.height > d.height + 1) problems.push(`${t.key}@${size}: "${e.name}" runs off the bottom`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("every bundled font file and its licence exist", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { POSTER_FONTS } = await import("@/lib/posters/fonts");
    for (const f of POSTER_FONTS) {
      const dir = path.resolve(__dirname, "../../public/fonts/poster");
      expect(fs.existsSync(path.join(dir, f.file)), f.file).toBe(true);
      expect(fs.existsSync(path.join(dir, `OFL-${f.file.replace(".woff2", "")}.txt`)), `licence for ${f.name}`).toBe(true);
    }
  });
});

describe("template text contrast", () => {
  // Decorative watermark text (deliberately faint, never the only place information appears).
  const DECORATIVE = new Set(["Series number"]);
  const ratio = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const mix = (fg: string, bg: string, a: number) => {
    const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
    return "#" + [1, 3, 5].map((i) => Math.round(p(fg, i) * a + p(bg, i) * (1 - a)).toString(16).padStart(2, "0")).join("");
  };

  test("every text meets WCAG AA against what's behind it (photo slots tested with a bright photo)", async () => {
    const { POSTER_TEMPLATES, templateDesign } = await import("@/lib/posters/templates");
    const failures: string[] = [];
    for (const size of ["square", "story"] as const) {
      for (const t of POSTER_TEMPLATES) {
        const d = templateDesign(t.key, size);
        for (const e of d.elements) {
          if (e.type !== "text" || DECORATIVE.has(e.name ?? "")) continue;
          const cx = e.x + e.width / 2;
          const cy = e.y + e.height / 2;
          // Background at the text's height (gradients blended), then each shape/photo underneath it.
          let behind = [d.background.gradient ? mix(d.background.gradient.to, d.background.gradient.from, cy / d.height) : d.background.color];
          for (const s of d.elements) {
            if (s === e) break;
            if (cx < s.x || cx > s.x + s.width || cy < s.y || cy > s.y + s.height) continue;
            if (s.type === "shape" && s.fill && s.shape !== "line") behind = behind.map((b) => mix(s.fill!, b, s.opacity * s.fillOpacity));
            if (s.type === "image" && s.overlay) behind = ["#9aa0aa", "#ffffff"].map((photo) => mix(s.overlay!.color, photo, s.overlay!.opacity));
          }
          const worst = Math.min(...behind.map((b) => ratio(e.fill, b)));
          const unit = d.width / 1080;
          const large = e.fontSize >= 48 * unit || (e.fontSize >= 37 * unit && e.fontWeight >= 700);
          if (worst < (large ? 3 : 4.5)) failures.push(`${size} ${t.key} "${e.name}": ${worst.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
