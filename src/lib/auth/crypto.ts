import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_VERSION = "scrypt-v1";
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string): string {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  return [
    PASSWORD_HASH_VERSION,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [version, saltHex, keyHex] = storedHash.split("$");
  if (
    version !== PASSWORD_HASH_VERSION ||
    typeof saltHex !== "string" ||
    typeof keyHex !== "string" ||
    saltHex.length === 0 ||
    keyHex.length === 0
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
