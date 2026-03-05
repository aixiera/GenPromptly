type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  burstWindowMs: number;
  burstMax: number;
};

type RateLimitEntry = {
  timestamps: number[];
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: "minute" | "burst";
  remaining: number;
  limit: number;
};

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30,
  burstWindowMs: 10_000,
  burstMax: 10,
};

function cleanup(entry: RateLimitEntry, now: number, windowMs: number): void {
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
}

function countInWindow(timestamps: number[], now: number, windowMs: number): number {
  let count = 0;
  for (const ts of timestamps) {
    if (now - ts < windowMs) {
      count += 1;
    }
  }
  return count;
}

function getRetryAfterSeconds(
  timestamps: number[],
  now: number,
  windowMs: number,
  threshold: number
): number {
  const recent = timestamps.filter((ts) => now - ts < windowMs).sort((a, b) => a - b);
  const pivotIndex = Math.max(0, recent.length - threshold);
  const pivot = recent[pivotIndex] ?? now;
  const retryAfterMs = Math.max(0, windowMs - (now - pivot));
  return Math.ceil(retryAfterMs / 1000);
}

export class InMemoryRateLimiter {
  private readonly config: RateLimitConfig;

  private readonly store = new Map<string, RateLimitEntry>();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...(config ?? {}),
    };
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const safeKey = key.trim() || "anonymous";
    const entry = this.store.get(safeKey) ?? { timestamps: [] };

    cleanup(entry, now, this.config.windowMs);

    const minuteCount = entry.timestamps.length;
    if (minuteCount >= this.config.maxRequests) {
      const retryAfterSeconds = getRetryAfterSeconds(
        entry.timestamps,
        now,
        this.config.windowMs,
        this.config.maxRequests
      );
      this.store.set(safeKey, entry);
      return {
        allowed: false,
        retryAfterSeconds,
        reason: "minute",
        remaining: 0,
        limit: this.config.maxRequests,
      };
    }

    const burstCount = countInWindow(entry.timestamps, now, this.config.burstWindowMs);
    if (burstCount >= this.config.burstMax) {
      const retryAfterSeconds = getRetryAfterSeconds(
        entry.timestamps,
        now,
        this.config.burstWindowMs,
        this.config.burstMax
      );
      this.store.set(safeKey, entry);
      return {
        allowed: false,
        retryAfterSeconds,
        reason: "burst",
        remaining: this.config.maxRequests - minuteCount,
        limit: this.config.maxRequests,
      };
    }

    entry.timestamps.push(now);
    this.store.set(safeKey, entry);

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, this.config.maxRequests - entry.timestamps.length),
      limit: this.config.maxRequests,
    };
  }
}

export const optimizeRateLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  burstWindowMs: 10_000,
  burstMax: 10,
});
