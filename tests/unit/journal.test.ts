import { beforeAll, describe, expect, test } from "vitest";
import { encryptJournalContent, fromBytea, readJournalRow, toBytea } from "@/lib/encryption";

// The journal round-trip through Postgres/PostgREST: bytea goes in as a hex
// literal and comes back as "\x…" hex text.

beforeAll(() => {
  process.env.JOURNAL_ENCRYPTION_KEY = "a".repeat(64);
});

describe("journal encryption storage", () => {
  test("new entries round-trip through the bytea hex format", () => {
    const enc = encryptJournalContent("Thank you for today.");
    // PostgREST returns exactly what toBytea stored.
    const row = { encrypted_content: toBytea(enc.encrypted_content), iv: toBytea(enc.iv), auth_tag: toBytea(enc.auth_tag) };
    expect(readJournalRow(row)).toBe("Thank you for today.");
  });

  test("entries saved by the original code (Buffer serialised as JSON text) still decrypt", () => {
    const enc = encryptJournalContent("An older entry");
    // What the old insert actually stored: the JSON text of the Buffer.
    const legacy = (b: Buffer) => toBytea(Buffer.from(JSON.stringify(b), "utf8"));
    const row = { encrypted_content: legacy(enc.encrypted_content), iv: legacy(enc.iv), auth_tag: legacy(enc.auth_tag) };
    expect(readJournalRow(row)).toBe("An older entry");
  });

  test("a damaged entry returns null instead of crashing the page", () => {
    const enc = encryptJournalContent("x");
    expect(readJournalRow({ encrypted_content: toBytea(enc.encrypted_content), iv: toBytea(enc.iv), auth_tag: toBytea(Buffer.alloc(16)) })).toBeNull();
  });

  test("fromBytea decodes hex", () => {
    expect(fromBytea("\\x48656c6c6f").toString()).toBe("Hello");
  });
});
