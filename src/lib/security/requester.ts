import { createHash } from "node:crypto";

const REQUEST_IP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
] as const;

const SAFE_IP_TOKEN = /^[0-9A-Fa-f:.]+$/;
const HASH_SALT = process.env.RATE_LIMIT_IP_SALT?.trim() || "genpromptly-rate-limit-salt";

function sanitizeIpToken(raw: string): string | null {
  const first = raw.split(",")[0]?.trim();
  if (!first || first.length > 80) {
    return null;
  }

  const unwrapped = first.replace(/^\[/, "").replace(/\]$/, "");
  const ipv4WithOptionalPort = unwrapped.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?$/);
  if (ipv4WithOptionalPort) {
    return ipv4WithOptionalPort[1];
  }

  if (SAFE_IP_TOKEN.test(unwrapped)) {
    return unwrapped;
  }

  return null;
}

function hashValue(value: string): string {
  return createHash("sha256").update(`${HASH_SALT}:${value}`).digest("hex").slice(0, 20);
}

export type RequesterFingerprint = {
  ip: string | null;
  ipHash: string;
  ipSource: string;
};

export function deriveRequesterFingerprint(req: Request): RequesterFingerprint {
  for (const header of REQUEST_IP_HEADERS) {
    const raw = req.headers.get(header);
    if (!raw) {
      continue;
    }
    const token = sanitizeIpToken(raw);
    if (token) {
      return {
        ip: token,
        ipHash: hashValue(token),
        ipSource: header,
      };
    }
  }

  return {
    ip: null,
    ipHash: hashValue("unknown-ip"),
    ipSource: "fallback",
  };
}

