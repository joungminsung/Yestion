import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";

const ISSUER = "Notion Web";

/**
 * Generate a new TOTP secret for a user.
 */
export function generateTotpSecret(email: string): {
  secret: string;
  uri: string;
} {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Generate a QR code data URL from a TOTP URI.
 */
export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    width: 256,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Verify a TOTP token against a secret.
 */
export function verifyTotp(token: string, secret: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Allow 1 period of drift (window=1 means +/- 1 period)
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

/**
 * Generate backup codes.
 */
export function generateBackupCodes(count: number = 8): string[] {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(8);
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j]! % chars.length];
    }
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}
