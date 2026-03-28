import { Prisma } from "@prisma/client";
import prisma from "../db";

type RateLimitMetricEvent = {
  policy: string;
  bucket: string;
  route: string;
  scope: string;
  eventType: string;
  actionKey: string;
  orgKey: string;
  userKey: string;
  ipHash: string;
  backend: string;
  source: string;
  retryAfterSeconds?: number;
  windowSeconds?: number;
  maxRequests?: number;
  metadata?: unknown;
};

const METRICS_ENABLED = process.env.RATE_LIMIT_METRICS_ENABLED !== "false";

let schemaUnavailable = false;
let lastWriteWarningAt = 0;

function minuteBucket(date = new Date()): Date {
  const value = new Date(date);
  value.setUTCSeconds(0, 0);
  return value;
}

function shouldWarn(now = Date.now()): boolean {
  if (now - lastWriteWarningAt < 30_000) {
    return false;
  }
  lastWriteWarningAt = now;
  return true;
}

function toFiniteInt(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.floor(value));
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

export function recordRateLimitMetric(event: RateLimitMetricEvent): void {
  if (!METRICS_ENABLED || schemaUnavailable) {
    return;
  }

  const bucket = minuteBucket();
  const retryAfter = toFiniteInt(event.retryAfterSeconds);
  const windowSeconds = toFiniteInt(event.windowSeconds);
  const maxRequests = toFiniteInt(event.maxRequests);
  const metadata = toJsonValue(event.metadata);

  void prisma.rateLimitMetricMinute.upsert({
    where: {
      minuteBucket_policy_route_scope_eventType_actionKey_orgKey_userKey_ipHash: {
        minuteBucket: bucket,
        policy: event.policy,
        route: event.route,
        scope: event.scope,
        eventType: event.eventType,
        actionKey: event.actionKey,
        orgKey: event.orgKey,
        userKey: event.userKey,
        ipHash: event.ipHash,
      },
    },
    create: {
      minuteBucket: bucket,
      policy: event.policy,
      bucket: event.bucket,
      route: event.route,
      scope: event.scope,
      eventType: event.eventType,
      actionKey: event.actionKey,
      orgKey: event.orgKey,
      userKey: event.userKey,
      ipHash: event.ipHash,
      backend: event.backend,
      source: event.source,
      count: 1,
      latestRetryAfterSeconds: retryAfter,
      windowSeconds,
      maxRequests,
      metadata,
    },
    update: {
      count: {
        increment: 1,
      },
      latestRetryAfterSeconds: retryAfter,
      windowSeconds,
      maxRequests,
      backend: event.backend,
      source: event.source,
      metadata,
    },
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
      schemaUnavailable = true;
      if (shouldWarn()) {
        console.warn("Rate-limit metrics disabled due to missing schema. Run prisma migrations.", {
          code: error.code,
        });
      }
      return;
    }

    if (shouldWarn()) {
      console.warn("Failed to write rate-limit metric event.", {
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });
}
