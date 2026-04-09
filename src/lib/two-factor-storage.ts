import crypto from "crypto";

type StoredTwoFactorV2 = {
  version: 2;
  totpEnabled: boolean;
  encryptedSecret: string;
  backupCodeHashes: string[];
};

type StoredTwoFactorLegacy = {
  totpEnabled?: boolean;
  totpSecret?: string;
  backupCodes?: string[];
};

export type ParsedTwoFactorData = {
  totpEnabled: boolean;
  totpSecret?: string;
  backupCodeHashes: string[];
  backupCodes?: string[];
  needsMigration: boolean;
};

const ALGORITHM = "aes-256-gcm";

function getTwoFactorKey(): Buffer {
  const secret =
    process.env.TWO_FACTOR_SECRET_KEY ??
    process.env.INTEGRATION_SECRET_KEY ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("A 2FA encryption secret is not configured");
  }

  return crypto.scryptSync(secret, "two-factor", 32);
}

function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getTwoFactorKey(), iv);
  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptSecret(ciphertext: string): string {
  const [ivHex = "", authTagHex = "", encrypted = ""] = ciphertext.split(":");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getTwoFactorKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function normalizeBackupCode(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizeBackupCode(code))
    .digest("hex");
}

export function serializeTwoFactorData(secret: string, backupCodes: string[]): string {
  const payload: StoredTwoFactorV2 = {
    version: 2,
    totpEnabled: true,
    encryptedSecret: encryptSecret(secret),
    backupCodeHashes: backupCodes.map(hashBackupCode),
  };

  return JSON.stringify(payload);
}

export function parseTwoFactorData(raw: string | null | undefined): ParsedTwoFactorData {
  if (!raw) {
    return {
      totpEnabled: false,
      backupCodeHashes: [],
      needsMigration: false,
    };
  }

  const parsed = JSON.parse(raw) as StoredTwoFactorV2 | StoredTwoFactorLegacy;

  if ("version" in parsed && parsed.version === 2) {
    return {
      totpEnabled: parsed.totpEnabled === true,
      totpSecret: parsed.encryptedSecret ? decryptSecret(parsed.encryptedSecret) : undefined,
      backupCodeHashes: parsed.backupCodeHashes ?? [],
      needsMigration: false,
    };
  }

  const legacy = parsed as StoredTwoFactorLegacy;
  return {
    totpEnabled: legacy.totpEnabled === true,
    totpSecret: legacy.totpSecret,
    backupCodeHashes: [],
    backupCodes: legacy.backupCodes ?? [],
    needsMigration: true,
  };
}

export function hasMatchingBackupCode(data: ParsedTwoFactorData, code: string): boolean {
  if (data.backupCodeHashes.length > 0) {
    return data.backupCodeHashes.includes(hashBackupCode(code));
  }

  return (data.backupCodes ?? []).includes(code);
}

export function consumeBackupCode(data: ParsedTwoFactorData, code: string): string {
  const normalizedSecret = data.totpSecret;
  if (!normalizedSecret) {
    throw new Error("No 2FA secret present");
  }

  if (data.backupCodeHashes.length > 0) {
    const usedHash = hashBackupCode(code);
    const nextHashes = data.backupCodeHashes.filter((hash) => hash !== usedHash);
    return JSON.stringify({
      version: 2,
      totpEnabled: data.totpEnabled,
      encryptedSecret: encryptSecret(normalizedSecret),
      backupCodeHashes: nextHashes,
    } satisfies StoredTwoFactorV2);
  }

  const nextCodes = (data.backupCodes ?? []).filter((backupCode) => backupCode !== code);
  return serializeTwoFactorData(normalizedSecret, nextCodes);
}
