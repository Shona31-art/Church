import { describe, expect, test } from "vitest";
import { booksMatching, findBook, formatReference, parseReference } from "@/lib/bible/reference";
import { BOOKS, nextChapter, previousChapter } from "@/lib/bible/books";

const idx = (name: string) => BOOKS.findIndex((b) => b.name === name);

describe("parseReference", () => {
  test.each([
    ["John 3:16", { bookIndex: idx("John"), chapter: 3, verse: 16 }],
    ["jn 3:16", { bookIndex: idx("John"), chapter: 3, verse: 16 }],
    ["john 3.16", { bookIndex: idx("John"), chapter: 3, verse: 16 }],
    ["  JOHN   3 : 16 ", { bookIndex: idx("John"), chapter: 3, verse: 16 }],
    ["1 cor 13:4-7", { bookIndex: idx("1 Corinthians"), chapter: 13, verse: 4, verseEnd: 7 }],
    ["1cor 13:4–7", { bookIndex: idx("1 Corinthians"), chapter: 13, verse: 4, verseEnd: 7 }],
    ["I John 4:8", { bookIndex: idx("1 John"), chapter: 4, verse: 8 }],
    ["2nd Kings 2", { bookIndex: idx("2 Kings"), chapter: 2 }],
    ["iii john 1:4", { bookIndex: idx("3 John"), chapter: 1, verse: 4 }],
    ["psalm 23", { bookIndex: idx("Psalms"), chapter: 23 }],
    ["Ps 119:105", { bookIndex: idx("Psalms"), chapter: 119, verse: 105 }],
    ["Song of Songs 2", { bookIndex: idx("Song of Solomon"), chapter: 2 }],
    ["Rev. 21:4", { bookIndex: idx("Revelation"), chapter: 21, verse: 4 }],
    ["Genesis", { bookIndex: idx("Genesis"), chapter: 1 }],
    ["phile 1:6", { bookIndex: idx("Philemon"), chapter: 1, verse: 6 }],
    ["phil 4:13", { bookIndex: idx("Philippians"), chapter: 4, verse: 13 }],
    ["Romans 8:28-28", { bookIndex: idx("Romans"), chapter: 8, verse: 28 }],
    ["Jude 24", { bookIndex: idx("Jude"), chapter: 1, verse: 24 }],
    ["Jude 1", { bookIndex: idx("Jude"), chapter: 1 }],
    ["Jude 1:3", { bookIndex: idx("Jude"), chapter: 1, verse: 3 }],
  ])("%s", (input, expected) => {
    expect(parseReference(input)).toEqual(expected);
  });

  test.each(["", "3:16", "jo 3:16", "Hezekiah 1", "John 22", "Jude 2:1", "John 3:0", "John 0", "hello world"])(
    "rejects %j",
    (input) => {
      expect(parseReference(input)).toBeNull();
    },
  );
});

describe("findBook and booksMatching", () => {
  test("ambiguous prefixes don't guess", () => {
    expect(findBook("jo")).toBe(-1);
    expect(booksMatching("jo").map((i) => BOOKS[i].name)).toEqual(["Joshua", "Job", "Joel", "Jonah", "John"]);
  });
  test("empty filter lists every book", () => {
    expect(booksMatching("")).toHaveLength(66);
  });
  test("numbered books filter by number", () => {
    expect(booksMatching("1").map((i) => BOOKS[i].name)).toEqual([
      "1 Samuel", "1 Kings", "1 Chronicles", "1 Corinthians", "1 Thessalonians", "1 Timothy", "1 Peter", "1 John",
    ]);
  });
});

describe("formatReference", () => {
  test("chapter, verse and range", () => {
    expect(formatReference({ bookIndex: idx("John"), chapter: 3 })).toBe("John 3");
    expect(formatReference({ bookIndex: idx("John"), chapter: 3, verse: 16 })).toBe("John 3:16");
    expect(formatReference({ bookIndex: idx("1 Corinthians"), chapter: 13, verse: 4, verseEnd: 7 })).toBe("1 Corinthians 13:4-7");
  });
});

describe("chapter navigation", () => {
  test("crosses book boundaries and stops at the ends", () => {
    expect(nextChapter({ bookIndex: idx("Malachi"), chapter: 4 })).toEqual({ bookIndex: idx("Matthew"), chapter: 1 });
    expect(previousChapter({ bookIndex: idx("Matthew"), chapter: 1 })).toEqual({ bookIndex: idx("Malachi"), chapter: 4 });
    expect(nextChapter({ bookIndex: idx("John"), chapter: 3 })).toEqual({ bookIndex: idx("John"), chapter: 4 });
    expect(previousChapter({ bookIndex: 0, chapter: 1 })).toBeNull();
    expect(nextChapter({ bookIndex: 65, chapter: 22 })).toBeNull();
  });
});
