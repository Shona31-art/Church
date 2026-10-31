import { describe, expect, test } from "vitest";
import { canManageSongs, parseSongList, songLetter, songSchema } from "@/lib/songs";

describe("songs", () => {
  test("bulk import splits on --- and reads title, key and writer", () => {
    const songs = parseSongList(`Way Maker
Key: E
By: Sinach
You are here, moving in our midst
I worship You

---
Goodness of God

I love You, Lord
---

`);
    expect(songs).toEqual([
      { title: "Way Maker", author: "Sinach", songKey: "E", lyrics: "You are here, moving in our midst\nI worship You" },
      { title: "Goodness of God", author: undefined, songKey: undefined, lyrics: "I love You, Lord" },
    ]);
  });

  test("pastors, admins and the worship team can manage; others can't", () => {
    expect(canManageSongs({ role: "pastor" }, null)).toBe(true);
    expect(canManageSongs({ role: "church_admin" }, null)).toBe(true);
    expect(canManageSongs({ role: "member", department_id: "w" }, "w")).toBe(true);
    expect(canManageSongs({ role: "department_leader", department_id: "x" }, "w")).toBe(false);
    expect(canManageSongs({ role: "member", department_id: null }, null)).toBe(false);
  });

  test("titles are required; Windows line endings are tidied", () => {
    expect(songSchema.safeParse({ title: " ", lyrics: "" }).success).toBe(false);
    expect(songSchema.parse({ title: "A", lyrics: "line 1\r\nline 2" }).lyrics).toBe("line 1\nline 2");
  });

  test("A–Z index letter", () => {
    expect(songLetter("amazing grace")).toBe("A");
    expect(songLetter("10,000 Reasons")).toBe("#");
  });
});
