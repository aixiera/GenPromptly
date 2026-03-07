import { NextResponse } from "next/server";
import { error } from "../api/response";
import { deriveRequesterFingerprint, type RequesterFingerprint } from "./requester";
import {
  getRateLimitPolicy,
  type RateLimitPolicyName,
  type RateLimitScope,
} from "./rateLimitPolicies";
import { createRateLimitStore } from "./rateLimitStore";
import { recordRateLimitMetric } from "./rateLimitMetrics";

type RateLimitActor = {
  userId?: string | null;
  orgId?: string | null;
  action?: string | null;
};

type RateLimitDecision = {
  ok: true;
  release?: () => void;
  requester: RequesterFingerprint;
} | {
  ok: false;
  response: NextResponse;
};

type BucketKeyContext = {
  requester: RequesterFingerprint;
  actor: RateLimitActor;
  actionSuffix: string;
};

const limiterStore = createRateLimitStore();
const inFlightByKey = new Map<string, number>();
const logDedupeByKey = new Map<string, number>();
const RATE_LIMIT_LOG_DEDUPE_MS = 15_000;

function sanitizeKeyPart(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 80);
}

function buildBucketIdentity(scope: RateLimitScope, ctx: BucketKeyContext): string {
  const ip = sanitizeKeyPart(ctx.requester.ipHash, "unknown_ip");
  const user = sanitizeKeyPart(ctx.actor.userId, "anonymous_user");
  const org = sanitizeKeyPart(ctx.actor.orgId, "unknown_org");
  const action = sanitizeKeyPart(ctx.actionSuffix, "default");

  switch (scope) {
    case "ip":
      return `${ip}:${action}`;
    case "user":
      return `${user}:${action}`;
    case "org":
      return `${org}:${action}`;
    case "user_org":
      return `${user}:${org}:${action}`;
    case "ip_user":
      return `${ip}:${user}:${action}`;
    case "ip_user_org":
      return `${ip}:${user}:${org}:${action}`;
    default:
      return `${ip}:${user}:${org}:${action}`;
  }
}

function maybeLogAbuseEvent(
  key: string,
  event: string,
  payload: {
    policy: string;
    scope: RateLimitScope;
    userId: string;
    orgId: string;
    ipHash: string;
    route: string;
    retryAfterSeconds?: number;
    source?: string;
  }
): void {
  const now = Date.now();
  const prev = logDedupeByKey.get(key) ?? 0;
  if (now - prev < RATE_LIMIT_LOG_DEDUPE_MS) {
    return;
  }
  logDedupeByKey.set(key, now);
  console.warn(`security.${event}`, payload);
}

type RecordMetricArgs = {
  policy: string;
  bucket: string;
  route: string;
  scope: RateLimitScope;
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
  metadata?: Record<string, unknown>;
};

function recordMetricEvent(args: RecordMetricArgs): void {
  recordRateLimitMetric({
    policy: args.policy,
    bucket: args.bucket,
    route: args.route,
    scope: args.scope,
    eventType: args.eventType,
    actionKey: args.actionKey,
    orgKey: args.orgKey,
    userKey: args.userKey,
    ipHash: args.ipHash,
    backend: args.backend,
    source: args.source,
    retryAfterSeconds: args.retryAfterSeconds,
    windowSeconds: args.windowSeconds,
    maxRequests: args.maxRequests,
    metadata: args.metadata,
  });
}

function buildTooManyRequestsResponse(
  policyName: string,
  routeLabel: string,
  scope: RateLimitScope,
  retryAfterSeconds: number,
  message: string,
  details: Record<string, unknown>
): NextResponse {
  const response = NextResponse.json(
    error("RATE_LIMITED", message, {
      ...details,
      policy: policyName,
      scope,
      retryAfterSeconds,
      route: routeLabel,
    }),
    { status: 429 }
  );
  response.headers.set("Retry-After", String(Math.max(1, retryAfterSeconds)));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-RateLimit-Policy", policyName);
  return response;
}

function applyConcurrencyGuard(
  policyName: string,
  routeLabel: string,
  message: string,
  ctx: BucketKeyContext,
  maxConcurrent: number,
  scope: RateLimitScope
): RateLimitDecision {
  const identity = buildBucketIdentity(scope, ctx);
  const key = `rl-concurrency:${policyName}:${scope}:${identity}`;
  const current = inFlightByKey.get(key) ?? 0;

  if (current >= maxConcurrent) {
    maybeLogAbuseEvent(key, "concurrency_block", {
      policy: policyName,
      scope,
      userId: sanitizeKeyPart(ctx.actor.userId, "anonymous_user"),
      orgId: sanitizeKeyPart(ctx.actor.orgId, "unknown_org"),
      ipHash: ctx.requester.ipHash,
      route: routeLabel,
      retryAfterSeconds: 1,
    });
    recordMetricEvent({
      policy: policyName,
      bucket: policyName,
      route: routeLabel,
      scope,
      eventType: "concurrency_block",
      actionKey: sanitizeKeyPart(ctx.actionSuffix, "default"),
      orgKey: sanitizeKeyPart(ctx.actor.orgId, "unknown_org"),
      userKey: sanitizeKeyPart(ctx.actor.userId, "anonymous_user"),
      ipHash: ctx.requester.ipHash,
      backend: limiterStore.kind,
      source: "concurrency-guard",
      retryAfterSeconds: 1,
      metadata: {
        maxConcurrent,
      },
    });
    return {
      ok: false,
      response: buildTooManyRequestsResponse(
        policyName,
        routeLabel,
        scope,
        1,
        message,
        { reason: "concurrency", maxConcurrent }
      ),
    };
  }

  inFlightByKey.set(key, current + 1);
  return {
    ok: true,
    requester: ctx.requester,
    release: () => {
      const active = inFlightByKey.get(key) ?? 0;
      if (active <= 1) {
        inFlightByKey.delete(key);
        return;
      }
      inFlightByKey.set(key, active - 1);
    },
  };
}

export function enforceRequestBodyLimit(req: Request, maxBytes: number, routeLabel?: string): NextResponse | null {
  const rawLength = req.headers.get("content-length")?.trim();
  if (!rawLength) {
    return null;
  }
  const contentLength = Number(rawLength);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    return null;
  }
  if (contentLength <= maxBytes) {
    return null;
  }

  const requester = deriveRequesterFingerprint(req);
  const safeRoute = sanitizeKeyPart(routeLabel, "unknown-route");
  maybeLogAbuseEvent(`payload:${safeRoute}:${requester.ipHash}`, "payload_rejected", {
    policy: "payload-limit",
    scope: "ip",
    userId: "anonymous_user",
    orgId: "unknown_org",
    ipHash: requester.ipHash,
    route: safeRoute,
  });
  recordMetricEvent({
    policy: "payload-limit",
    bucket: "payload-limit",
    route: safeRoute,
    scope: "ip",
    eventType: "payload_rejected",
    actionKey: "payload",
    orgKey: "unknown_org",
    userKey: "anonymous_user",
    ipHash: requester.ipHash,
    backend: limiterStore.kind,
    source: "payload-guard",
    metadata: {
      maxBytes,
      contentLength,
    },
  });

  return NextResponse.json(
    error("PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes`),
    { status: 413 }
  );
}

export async function enforceRateLimit(
  req: Request,
  policyName: RateLimitPolicyName,
  actor: RateLimitActor = {},
  routeLabel?: string
): Promise<RateLimitDecision> {
  const policy = getRateLimitPolicy(policyName);
  const requester = deriveRequesterFingerprint(req);
  const route = sanitizeKeyPart(routeLabel ?? policy.bucket, policy.bucket);
  const actionSuffix = sanitizeKeyPart(actor.action ?? "default", "default");
  const userKey = sanitizeKeyPart(actor.userId, "anonymous_user");
  const orgKey = sanitizeKeyPart(actor.orgId, "unknown_org");
  const keyContext: BucketKeyContext = {
    requester,
    actor,
    actionSuffix,
  };

  for (const rule of policy.rules) {
    const identity = buildBucketIdentity(rule.scope, keyContext);
    const key = `rl:${policy.bucket}:${rule.scope}:${rule.windowMs}:${identity}`;
    const counter = await limiterStore.increment(key, rule.windowMs);
    if (counter.count <= rule.maxRequests) {
      continue;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((counter.resetAtMs - Date.now()) / 1000));
    maybeLogAbuseEvent(key, "rate_limited", {
      policy: policyName,
      scope: rule.scope,
      userId: userKey,
      orgId: orgKey,
      ipHash: requester.ipHash,
      route,
      retryAfterSeconds,
      source: counter.source,
    });
    recordMetricEvent({
      policy: policyName,
      bucket: policy.bucket,
      route,
      scope: rule.scope,
      eventType: rule.enforcement === "soft" ? "rate_limited_soft" : "rate_limited",
      actionKey: actionSuffix,
      orgKey,
      userKey,
      ipHash: requester.ipHash,
      backend: limiterStore.kind,
      source: counter.source,
      retryAfterSeconds,
      windowSeconds: Math.floor(rule.windowMs / 1000),
      maxRequests: rule.maxRequests,
    });

    if (rule.enforcement === "soft") {
      continue;
    }

    return {
      ok: false,
      response: buildTooManyRequestsResponse(
        policyName,
        route,
        rule.scope,
        retryAfterSeconds,
        policy.message,
        {
          reason: "window_limit",
          windowSeconds: Math.floor(rule.windowMs / 1000),
          maxRequests: rule.maxRequests,
          backend: limiterStore.kind,
        }
      ),
    };
  }

  if (policy.concurrency) {
    const concurrencyDecision = applyConcurrencyGuard(
      policyName,
      route,
      policy.message,
      keyContext,
      policy.concurrency.maxConcurrent,
      policy.concurrency.scope
    );
    if (!concurrencyDecision.ok) {
      return concurrencyDecision;
    }
    return concurrencyDecision;
  }

  return {
    ok: true,
    requester,
  };
}
