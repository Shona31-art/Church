import crypto from "crypto";

/**
 * Server-only. Never import this file into a client component.
 *
 * Encrypts/decrypts journal content with AES-256-GCM. The key lives in
 * server environment config (JOURNAL_ENCRYPTION_KEY), never in the database,
 * so a database dump alone doesn't expose journal text.
 *
 * Honest limitation: this is app-managed encryption, not zero-knowledge.
 * Someone with BOTH the server's environment secrets and the database could
 * decrypt entries.
 */

function getKey(): Buffer {
  const hex = process.env.JOURNAL_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("JOURNAL_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

export function isJournalEncryptionConfigured(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env.JOURNAL_ENCRYPTION_KEY ?? "");
}

export function encryptJournalContent(plaintext: string): { encrypted_content: Buffer; iv: Buffer; auth_tag: Buffer } {
  const iv = crypto.randomBytes(12); // GCM standard IV length
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { encrypted_content: encrypted, iv, auth_tag: cipher.getAuthTag() };
}

export function decryptJournalContent(row: { encrypted_content: Buffer; iv: Buffer; auth_tag: Buffer }): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), row.iv);
  decipher.setAuthTag(row.auth_tag);
  return Buffer.concat([decipher.update(row.encrypted_content), decipher.final()]).toString("utf8");
}

/** Buffer → the hex literal PostgREST stores correctly in a bytea column. */
export function toBytea(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}

/**
 * A bytea value as returned by PostgREST ("\x…" hex) → Buffer.
 *
 * Also reads entries written by the app's original code, which passed raw
 * Buffers to supabase-js: JSON serialisation turned them into the text
 * {"type":"Buffer","data":[…]}, and THAT text is what got stored. We detect
 * that shape after hex-decoding and recover the real bytes.
 */
export function fromBytea(value: unknown): Buffer {
  if (value && typeof value === "object" && (value as any).type === "Buffer" && Array.isArray((value as any).data)) {
    return Buffer.from((value as any).data);
  }
  if (typeof value !== "string") throw new Error("Unexpected bytea value");
  const raw = value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64");
  if (raw[0] === 0x7b /* { */) {
    try {
      const parsed = JSON.parse(raw.toString("utf8"));
      if (parsed?.type === "Buffer" && Array.isArray(parsed.data)) return Buffer.from(parsed.data);
    } catch {
      // Not the legacy JSON shape — real ciphertext that happens to start with "{".
    }
  }
  return raw;
}

/** Decrypts a journal row as read from the database; null if it can't be read. */
export function readJournalRow(row: { encrypted_content: unknown; iv: unknown; auth_tag: unknown }): string | null {
  try {
    return decryptJournalContent({
      encrypted_content: fromBytea(row.encrypted_content),
      iv: fromBytea(row.iv),
      auth_tag: fromBytea(row.auth_tag),
    });
  } catch (error) {
    console.error("[journal] could not decrypt an entry:", error instanceof Error ? error.message : error);
    return null;
  }
}
