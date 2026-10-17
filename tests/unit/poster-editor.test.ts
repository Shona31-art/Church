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
