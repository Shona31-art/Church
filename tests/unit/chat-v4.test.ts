import { describe, expect, test } from "vitest";
import { disappearLabel, lastSeenLabel, mentionQuery, mentionedIds, splitMentions, tallyPoll } from "@/lib/chat";

describe("last seen", () => {
  const now = new Date("2026-11-02T12:00:00Z"); // 14:00 in Johannesburg
  test("online within the last minute and a half", () => {
    expect(lastSeenLabel("2026-11-02T11:59:10Z", now, "Africa/Johannesburg")).toBe("online");
  });
  test("today, yesterday, this week, then a date", () => {
    expect(lastSeenLabel("2026-11-02T08:15:00Z", now, "Africa/Johannesburg")).toBe("last seen today at 10:15");
    expect(lastSeenLabel("2026-11-01T18:30:00Z", now, "Africa/Johannesburg")).toBe("last seen yesterday at 20:30");
    expect(lastSeenLabel("2026-10-29T07:00:00Z", now, "Africa/Johannesburg")).toBe("last seen Thursday at 09:00");
    expect(lastSeenLabel("2026-09-03T07:00:00Z", now, "Africa/Johannesburg")).toMatch(/^last seen 0?3 Sep/);
  });
});

describe("@mentions", () => {
  test("finds the @word being typed at the cursor", () => {
    expect(mentionQuery("hi @Al", 6)).toEqual({ query: "Al", start: 3 });
    expect(mentionQuery("@", 1)).toEqual({ query: "", start: 0 });
    expect(mentionQuery("email@test", 10)).toBeNull(); // not after a space
    expect(mentionQuery("hi @Al there", 12)).toBeNull();
  });
  test("only people whose @Name is still in the text count", () => {
    expect(mentionedIds("thanks @Alice Brown!", { a: "Alice Brown", b: "Bob" })).toEqual(["a"]);
  });
  test("splits text around mentions, longest names first", () => {
    expect(splitMentions("hi @Ann Lee and @Ann", ["Ann", "Ann Lee"])).toEqual([
      { text: "hi ", mention: false },
      { text: "@Ann Lee", mention: true },
      { text: " and ", mention: false },
      { text: "@Ann", mention: true },
    ]);
    expect(splitMentions("no names", [])).toEqual([{ text: "no names", mention: false }]);
  });
});

describe("polls and disappearing messages", () => {
  test("tallies votes per option and counts each voter once", () => {
    const t = tallyPoll(3, [
      { message_id: "m", user_id: "a", option_index: 0 },
      { message_id: "m", user_id: "a", option_index: 2 },
      { message_id: "m", user_id: "b", option_index: 0 },
      { message_id: "m", user_id: "c", option_index: 9 }, // not an option: ignored
    ]);
    expect(t.counts).toEqual([2, 0, 1]);
    expect(t.voters[0]).toEqual(["a", "b"]);
    expect(t.total).toBe(3);
  });
  test("timer labels", () => {
    expect(disappearLabel(86400)).toBe("24 hours");
    expect(disappearLabel(null)).toBeNull();
  });
});
