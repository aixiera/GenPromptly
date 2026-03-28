-- Operational metrics pipeline for rate-limit and anti-abuse events.
CREATE TABLE "RateLimitMetricMinute" (
  "id" TEXT NOT NULL,
  "minuteBucket" TIMESTAMP(3) NOT NULL,
  "policy" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "orgKey" TEXT NOT NULL,
  "userKey" TEXT NOT NULL,
  "ipHash" TEXT NOT NULL,
  "backend" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "latestRetryAfterSeconds" INTEGER,
  "windowSeconds" INTEGER,
  "maxRequests" INTEGER,
  "metadata" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitMetricMinute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimitMetricMinute_minuteBucket_policy_route_scope_eventType_actionKey_orgKey_userKey_ipHash_key"
  ON "RateLimitMetricMinute"(
    "minuteBucket",
    "policy",
    "route",
    "scope",
    "eventType",
    "actionKey",
    "orgKey",
    "userKey",
    "ipHash"
  );

CREATE INDEX "RateLimitMetricMinute_minuteBucket_idx" ON "RateLimitMetricMinute"("minuteBucket");
CREATE INDEX "RateLimitMetricMinute_policy_minuteBucket_idx" ON "RateLimitMetricMinute"("policy", "minuteBucket");
CREATE INDEX "RateLimitMetricMinute_bucket_minuteBucket_idx" ON "RateLimitMetricMinute"("bucket", "minuteBucket");
CREATE INDEX "RateLimitMetricMinute_route_minuteBucket_idx" ON "RateLimitMetricMinute"("route", "minuteBucket");
CREATE INDEX "RateLimitMetricMinute_orgKey_minuteBucket_idx" ON "RateLimitMetricMinute"("orgKey", "minuteBucket");
CREATE INDEX "RateLimitMetricMinute_userKey_minuteBucket_idx" ON "RateLimitMetricMinute"("userKey", "minuteBucket");
