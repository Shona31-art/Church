import { describe, expect, test } from "vitest";
import {
  baseMimeType,
  canDeleteMessage,
  canEditMessage,
  chatMediaPath,
  dayLabel,
  formatDuration,
  mediaExpiryCutoff,
  messagePreview,
  pickRecordingFormat,
  startsGroup,
  summarizeReactions,
  type ChatMessage,
} from "@/lib/chat";

const ME = "me";
const base: ChatMessage = {
  id: "m1",
  channel_id: "c1",
  sender_id: ME,
  content: "Hello",
  created_at: "2026-10-10T08:00:00Z",
  kind: "text",
  edited_at: null,
  deleted_at: null,
  deleted_by: null,
  reply_to_id: null,
  media_path: null,
  media_duration_ms: null,
  media_expired_at: null,
};
const at = (iso: string) => new Date(iso).getTime();

describe("canEditMessage", () => {
  test("own text message inside 15 minutes", () => {
    expect(canEditMessage(base, ME, at("2026-10-10T08:14:59Z"))).toBe(true);
  });

  test("not after 15 minutes, not others', not deleted, not voice, not unsent", () => {
    expect(canEditMessage(base, ME, at("2026-10-10T08:15:00Z"))).toBe(false);
    expect(canEditMessage(base, "someone", at("2026-10-10T08:01:00Z"))).toBe(false);
    expect(canEditMessage({ ...base, deleted_at: "2026-10-10T08:01:00Z" }, ME, at("2026-10-10T08:02:00Z"))).toBe(false);
    expect(canEditMessage({ ...base, kind: "voice" }, ME, at("2026-10-10T08:01:00Z"))).toBe(false);
    expect(canEditMessage({ ...base, pending: true }, ME, at("2026-10-10T08:01:00Z"))).toBe(false);
  });
});

describe("canDeleteMessage", () => {
  test("sender always; others only as a moderator; never twice", () => {
    expect(canDeleteMessage(base, ME, false)).toBe(true);
    expect(canDeleteMessage(base, "someone", false)).toBe(false);
    expect(canDeleteMessage(base, "someone", true)).toBe(true);
    expect(canDeleteMessage({ ...base, deleted_at: "2026-10-10T08:01:00Z" }, ME, true)).toBe(false);
  });
});

describe("summarizeReactions", () => {
  test("counts per emoji in a fixed order and marks your own", () => {
    const summary = summarizeReactions(
      [
        { message_id: "m1", user_id: "a", emoji: "🙏" },
        { message_id: "m1", user_id: ME, emoji: "🙏" },
        { message_id: "m1", user_id: "b", emoji: "👍" },
      ],
      ME
    );
    expect(summary).toEqual([
      { emoji: "👍", count: 1, mine: false },
      { emoji: "🙏", count: 2, mine: true },
    ]);
  });
});

describe("startsGroup", () => {
  const next = { ...base, id: "m2", created_at: "2026-10-10T08:03:00Z" };
  test("same sender within 5 minutes continues the group", () => {
    expect(startsGroup(next, base)).toBe(false);
  });
  test("a different sender, a long gap or a new day starts a new group", () => {
    expect(startsGroup({ ...next, sender_id: "other" }, base)).toBe(true);
    expect(startsGroup({ ...next, created_at: "2026-10-10T08:06:00Z" }, base)).toBe(true);
    expect(startsGroup({ ...next, created_at: "2026-10-10T21:59:00Z" }, { ...base, created_at: "2026-10-10T21:58:00Z" })).toBe(false);
    // 21:58 UTC → 23:58 in Johannesburg; 22:01 UTC → 00:01 the next day.
    expect(startsGroup({ ...next, created_at: "2026-10-10T22:01:00Z" }, { ...base, created_at: "2026-10-10T21:58:00Z" })).toBe(true);
  });
});

describe("dayLabel", () => {
  const now = new Date("2026-10-10T10:00:00Z");
  test("today, yesterday, weekday within a week, then a date", () => {
    expect(dayLabel("2026-10-10T06:00:00Z", now, "Africa/Johannesburg")).toBe("Today");
    expect(dayLabel("2026-10-09T06:00:00Z", now, "Africa/Johannesburg")).toBe("Yesterday");
    expect(dayLabel("2026-10-06T06:00:00Z", now, "Africa/Johannesburg")).toBe("Tuesday");
    expect(dayLabel("2026-09-20T06:00:00Z", now, "Africa/Johannesburg")).toMatch(/20 Sept? 2026/);
  });
});

describe("messagePreview", () => {
  test("text is flattened and shortened; other kinds are named", () => {
    expect(messagePreview({ ...base, content: "Line one\nline two" })).toBe("Line one line two");
    expect(messagePreview({ ...base, content: "x".repeat(200) })).toHaveLength(90);
    expect(messagePreview({ ...base, kind: "voice", content: "" })).toBe("Voice note");
    expect(messagePreview({ ...base, deleted_at: "2026-10-10T08:01:00Z" })).toBe("This message was deleted");
  });
});

describe("voice notes", () => {
  test("durations read like a clock", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(83_000)).toBe("1:23");
    expect(formatDuration(120_000)).toBe("2:00");
  });

  test("recording format prefers MP4 (plays everywhere), then WebM, then Ogg", () => {
    expect(pickRecordingFormat(() => true)).toEqual({ mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a" });
    expect(pickRecordingFormat((m) => m === "audio/mp4")).toEqual({ mimeType: "audio/mp4", extension: "m4a" });
    expect(pickRecordingFormat((m) => m.startsWith("audio/webm"))).toEqual({ mimeType: "audio/webm;codecs=opus", extension: "webm" });
    expect(pickRecordingFormat(() => false)).toBeNull();
    expect(baseMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
  });

  test("files go in the church/channel/sender folder", () => {
    expect(chatMediaPath("ch", "c1", "u1", "f", "m4a")).toBe("ch/c1/u1/f.m4a");
  });

  test("files expire 90 days after sending", () => {
    expect(mediaExpiryCutoff(new Date("2026-10-10T00:00:00Z")).toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });
});
