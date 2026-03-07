import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeConnectionString(raw: string): string {
  const unquoted = stripWrappingQuotes(raw);
  if (!unquoted) {
    return "";
  }

  let parsed: URL;
  try {
    parsed = new URL(unquoted);
  } catch {
    return unquoted;
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    return unquoted;
  }

  // `pg` warns and will change semantics for these sslmode values.
  const sslmode = parsed.searchParams.get("sslmode");
  const hasLibpqCompat = parsed.searchParams.get("uselibpqcompat");
  if (!hasLibpqCompat && (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca")) {
    parsed.searchParams.set("uselibpqcompat", "true");
  }

  // Some managed providers include this parameter for psql/libpq.
  // The JS pg adapter does not need it and can treat it inconsistently.
  if (parsed.searchParams.get("channel_binding") === "require") {
    parsed.searchParams.delete("channel_binding");
  }

  return parsed.toString();
}

function resolveConnectionString(): string {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";
  const forcePooler = process.env.PRISMA_FORCE_POOLER === "true";
  const preferDirect = process.env.PRISMA_PREFER_DIRECT === "true";
  const normalizedDatabase = normalizeConnectionString(databaseUrl);
  const normalizedDirect = normalizeConnectionString(directUrl);

  // Default to DATABASE_URL; opt into DIRECT_URL via PRISMA_PREFER_DIRECT=true.
  // PRISMA_FORCE_POOLER=true hard-locks DATABASE_URL when it is available.
  if (forcePooler) {
    return normalizedDatabase || normalizedDirect;
  }

  if (preferDirect && normalizedDirect) {
    return normalizedDirect;
  }

  return normalizedDatabase || normalizedDirect;
}

const connectionString = resolveConnectionString();
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be configured.");
}

const adapter = new PrismaPg(
  { connectionString },
  {
    onConnectionError: (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Prisma connection error:", err.message);
      }
    },
  }
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
