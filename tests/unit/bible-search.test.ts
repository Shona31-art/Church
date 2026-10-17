import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { booksFor, buildMatcher, matchRanges, normalise, queryTerms, searchBook } from "@/lib/bible/search";
import { BOOKS, type BookText } from "@/lib/bible/books";

const readBook = (version: string, index: number): BookText =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../public/bibles", version, `${String(index + 1).padStart(2, "0")}-${BOOKS[index].slug}.json`),
      "utf8",
    ),
  );

describe("queryTerms", () => {
  test("words, phrases, case and punctuation", () => {
    expect(queryTerms("Love one ANOTHER")).toEqual(["love", "one", "another"]);
    expect(queryTerms('"my shepherd" want')).toEqual(["my shepherd", "want"]);
    expect(queryTerms("  ?!  ")).toEqual([]);
    expect(queryTerms("“curly” quotes")).toEqual(["curly", "quotes"]);
  });
});

describe("buildMatcher", () => {
  test("rejects queries with nothing to search", () => {
    expect(buildMatcher("")).toBeNull();
    expect(buildMatcher("a")).toBeNull();
    expect(buildMatcher("!!")).toBeNull();
  });

  test("word starts, all words, phrases", () => {
    const m = buildMatcher("love")!;
    expect(m.test("God so loved the world")).toBe(true);
    expect(m.test("a glove")).toBe(false);
    expect(buildMatcher("love world")!.test("God so loved the world")).toBe(true);
    expect(buildMatcher("love heaven")!.test("God so loved the world")).toBe(false);
    expect(buildMatcher('"the world"')!.test("God so loved the world")).toBe(true);
    expect(buildMatcher('"world the"')!.test("God so loved the world")).toBe(false);
  });

  test("ignores supplied-word brackets, accents and case", () => {
    expect(buildMatcher("the lord is my shepherd")!.test("Jehovah [is] my shepherd; I shall not want.")).toBe(false);
    expect(buildMatcher('"is my shepherd"')!.test("Jehovah [is] my shepherd")).toBe(true);
    expect(normalise("Café [is] “Here”")).toBe('cafe is "here"');
  });
});

describe("matchRanges", () => {
  test("marks whole words that start with a term, merged and in order", () => {
    const text = "God so loved the world, that he gave his only born Son";
    const ranges = matchRanges(text, ["love", "world"]);
    expect(ranges.map(([s, e]) => text.slice(s, e))).toEqual(["loved", "world"]);
  });
});

describe("searching real text", () => {
  test("Psalm 23:1 and John 3:16 are found; testament filters work", () => {
    const shepherd = searchBook(18, readBook("kjv", 18), buildMatcher('"my shepherd"')!);
    expect(shepherd.some((h) => h.chapter === 23 && h.verse === 1)).toBe(true);

    const john = searchBook(42, readBook("web", 42), buildMatcher("loved world only")!);
    expect(john.map((h) => `${h.chapter}:${h.verse}`)).toContain("3:16");

    expect(booksFor("ot")).toHaveLength(39);
    expect(booksFor("nt")[0]).toBe(39);
    expect(booksFor("all")).toHaveLength(66);
  });
});
