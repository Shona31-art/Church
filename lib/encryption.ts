import crypto from "crypto";

/**
 * Server-only. Never import this file into a client component.
 *
 * Encrypts/decrypts journal content with AES-256-GCM. The key lives in
 * server environment config (JOURNAL_ENCRYPTION_KEY), never in the database.
 * This means a raw database dump/leak does not expose journal plaintext —
 * an attacker would also need the server's environment secrets.
 *
 * Honest limitation: this is app-managed encryption, not zero-knowledge.
 * Anyone with access to the server's environment variables AND the database
 * could technically decrypt entries. True zero-knowledge (member-only key,
 * derived from a passphrase never sent to the server) is a stronger but
 * higher-friction option — see SA_COMPLIANCE / journal design notes.
 */

function getKey(): Buffer {
  const hex = process.env.JOURNAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "JOURNAL_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptJournalContent(plaintext: string): {
  encrypted_content: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
} {
  const iv = crypto.randomBytes(12); // GCM standard IV length
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted_content: encrypted, iv, auth_tag: authTag };
}

export function decryptJournalContent(row: {
  encrypted_content: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
}): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), row.iv);
  decipher.setAuthTag(row.auth_tag);

  const decrypted = Buffer.concat([
    decipher.update(row.encrypted_content),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
