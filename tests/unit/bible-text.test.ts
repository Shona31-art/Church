import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import canon from "@/lib/bible/canon.json";
import versions from "@/public/bibles/versions.json";

// Guards the generated files in public/bibles/ (built by scripts/build-bibles.mjs):
// a truncated or misaligned book would silently show the wrong verses.

const DIR = path.resolve(__dirname, "../../public/bibles");

function readBook(versionId: string, index: number): { book: string; chapters: string[][] } {
  const b = canon[index];
  const file = path.join(DIR, versionId, `${String(index + 1).padStart(2, "0")}-${b.slug}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

describe("canon", () => {
  test("66 books with unique names, slugs and abbreviations", () => {
    expect(canon).toHaveLength(66);
    expect(new Set(canon.map((b) => b.slug)).size).toBe(66);
    const keys = canon.flatMap((b) => [b.name.toLowerCase(), ...b.abbr]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(canon.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
  });
});

describe.each(versions.map((v) => [v.abbreviation, v] as const))("%s text files", (_, version) => {
  test("every book is present with the right chapter count and no blank chapters", () => {
    let verses = 0;
    canon.forEach((b, i) => {
      const data = readBook(version.id, i);
      expect(data.book).toBe(b.name);
      expect(data.chapters).toHaveLength(b.chapters);
      for (const chapter of data.chapters) {
        expect(chapter.length).toBeGreaterThan(0);
        expect(chapter[0]).not.toBe(""); // verse 1 always exists
        verses += chapter.filter(Boolean).length;
      }
    });
    expect(verses).toBe(version.verses);
    // The full Protestant canon is ~31,102 verses; a few versions omit
    // verses that others keep (footnoted in modern translations).
    expect(verses).toBeGreaterThan(31_050);
  });

  test("square brackets (translator-supplied words) are always balanced", () => {
    const unbalanced: string[] = [];
    canon.forEach((b, i) => {
      readBook(version.id, i).chapters.forEach((chapter, ci) =>
        chapter.forEach((verse, vi) => {
          // Strip properly nested [..] pairs; any bracket left over is unbalanced.
          let rest = verse;
          while (/\[[^[\]]*\]/.test(rest)) rest = rest.replace(/\[[^[\]]*\]/g, "");
          if (/[[\]]/.test(rest)) unbalanced.push(`${b.name} ${ci + 1}:${vi + 1}`);
        }),
      );
    });
    expect(unbalanced).toEqual([]);
  });

  test("spot checks: John 3:16 and Psalm 23:1", () => {
    expect(readBook(version.id, 42).chapters[2][15]).toMatch(/God .*love.* the world/i); // YLT: "God did so love the world"
    expect(readBook(version.id, 18).chapters[22][0]).toMatch(/shepherd/i);
  });
});
