import { describe, expect, test } from "vitest";
import { attachmentPathFor, attachmentProblem, isOwnAttachmentPath } from "@/lib/support";

const ME = "10000000-0000-0000-0000-000000000003";
const OTHER = "20000000-0000-0000-0000-000000000002";
const FILE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("attachmentProblem", () => {
  test("accepts a normal screenshot", () => {
    expect(attachmentProblem({ type: "image/png", size: 200_000 })).toBeNull();
  });

  test("rejects SVG (it can carry scripts) and non-images", () => {
    expect(attachmentProblem({ type: "image/svg+xml", size: 1000 })).toMatch(/PNG/);
    expect(attachmentProblem({ type: "text/html", size: 1000 })).toMatch(/PNG/);
  });

  test("rejects files over 5 MB", () => {
    expect(attachmentProblem({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});

describe("isOwnAttachmentPath", () => {
  test("accepts a path the upload widget produces for this user", () => {
    expect(isOwnAttachmentPath(attachmentPathFor(ME, "image/jpeg", FILE_ID), ME)).toBe(true);
  });

  test("rejects another user's file", () => {
    expect(isOwnAttachmentPath(attachmentPathFor(OTHER, "image/png", FILE_ID), ME)).toBe(false);
  });

  test("rejects full URLs, traversal and odd extensions", () => {
    expect(isOwnAttachmentPath(`https://evil.example/${ME}/${FILE_ID}.png`, ME)).toBe(false);
    expect(isOwnAttachmentPath(`${ME}/../${OTHER}/${FILE_ID}.png`, ME)).toBe(false);
    expect(isOwnAttachmentPath(`${ME}/${FILE_ID}.svg`, ME)).toBe(false);
  });
});
