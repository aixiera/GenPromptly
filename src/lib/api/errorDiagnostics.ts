import { Prisma } from "@prisma/client";
import { HttpError } from "./httpError";
import { isDatabaseConfigurationError } from "../db";

type PrismaKnownError = Prisma.PrismaClientKnownRequestError;

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function makeSchemaOutdatedError(error: PrismaKnownError, scope: string): HttpError {
  return new HttpError(
    503,
    "DATABASE_SCHEMA_OUTDATED",
    "Database schema is out of date. Run pnpm exec prisma migrate deploy and pnpm db:seed.",
    {
      scope,
      prismaCode: error.code,
      meta: error.meta ?? null,
    }
  );
}

function makeConnectionError(code: string, scope: string, details?: unknown): HttpError {
  return new HttpError(
    503,
    "DATABASE_UNAVAILABLE",
    "Database connection failed. Check DATABASE_URL/DIRECT_URL and network access.",
    {
      scope,
      prismaCode: code,
      details: details ?? null,
    }
  );
}

export function toInfraHttpError(error: unknown, scope: string): HttpError | null {
  if (isDatabaseConfigurationError(error)) {
    return new HttpError(
      503,
      "DATABASE_NOT_CONFIGURED",
      "Database is not configured. Set DATABASE_URL or DIRECT_URL in the deployment environment.",
      { scope }
    );
  }

  if (isPrismaKnownError(error)) {
    if (error.code === "P2021" || error.code === "P2022") {
      return makeSchemaOutdatedError(error, scope);
    }

    if (error.code === "P1000" || error.code === "P1001" || error.code === "P1002" || error.code === "P1017") {
      return makeConnectionError(error.code, scope, error.meta);
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return makeConnectionError("PRISMA_INIT", scope, error.message);
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new HttpError(503, "DATABASE_ENGINE_ERROR", "Database engine failed unexpectedly.", {
      scope,
      details: error.message,
    });
  }

  return null;
}

export function logUnhandledApiError(scope: string, error: unknown): void {
  console.error(`[${scope}]`, error);
}
