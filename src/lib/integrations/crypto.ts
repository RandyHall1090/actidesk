import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!key) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return buf;
}

/**
 * Encrypts a JSON-serializable credentials object (e.g. an OAuth token
 * pair) into one opaque base64 string: iv (12 bytes) + GCM auth tag (16
 * bytes) + ciphertext, concatenated. Server-only -- never call from a
 * Client Component.
 */
export function encryptCredentials(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Reverses encryptCredentials. Throws if the key is wrong or the stored
 * value was tampered with (GCM's auth tag check fails closed).
 */
export function decryptCredentials<T = unknown>(encoded: string): T {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
