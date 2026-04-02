import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.INTEGRATION_SECRET_KEY;
  if (!key) throw new Error("INTEGRATION_SECRET_KEY not set");
  return crypto.scryptSync(key, "salt", 32);
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(":");
  const ivHex = parts[0] ?? "";
  const authTagHex = parts[1] ?? "";
  const encrypted = parts[2] ?? "";
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Verify an HMAC-signed OAuth state parameter.
 * Returns the parsed payload if valid, throws otherwise.
 */
export function signOAuthState(workspaceId: string): string {
  const key = process.env.INTEGRATION_SECRET_KEY;
  if (!key) throw new Error("INTEGRATION_SECRET_KEY not set");

  const payload = JSON.stringify({ workspaceId, ts: Date.now() });
  const hmac = crypto
    .createHmac("sha256", key)
    .update(payload)
    .digest("hex");
  return Buffer.from(JSON.stringify({ payload, hmac })).toString("base64url");
}

export function verifyOAuthState(state: string): { workspaceId: string; ts: number } {
  const key = process.env.INTEGRATION_SECRET_KEY;
  if (!key) throw new Error("INTEGRATION_SECRET_KEY not set");

  const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
  const { payload, hmac } = decoded;

  const expected = crypto
    .createHmac("sha256", key)
    .update(payload)
    .digest("hex");

  // Use timing-safe comparison for HMAC verification
  if (
    expected.length !== hmac.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  const parsed = JSON.parse(payload);

  // Reject states older than 10 minutes
  if (Date.now() - parsed.ts > 10 * 60 * 1000) {
    throw new Error("OAuth state expired");
  }

  return parsed;
}
