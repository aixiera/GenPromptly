type RateLimitCounter = {
  count: number;
  resetAtMs: number;
};

export type RateLimitStoreKind = "memory" | "upstash" | "upstash-with-memory-fallback";

export type RateLimitIncrementResult = {
  count: number;
  resetAtMs: number;
  source: "memory" | "upstash" | "fallback-memory";
};

export interface RateLimitStore {
  kind: RateLimitStoreKind;
  increment(key: string, windowMs: number): Promise<RateLimitIncrementResult>;
}

class InMemoryRateLimitStore implements RateLimitStore {
  readonly kind: RateLimitStoreKind;

  private readonly counters = new Map<string, RateLimitCounter>();

  constructor(kind: RateLimitStoreKind = "memory") {
    this.kind = kind;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitIncrementResult> {
    const now = Date.now();
    const existing = this.counters.get(key);
    if (!existing || existing.resetAtMs <= now) {
      const freshCounter = {
        count: 1,
        resetAtMs: now + windowMs,
      };
      this.counters.set(key, freshCounter);
      return {
        count: freshCounter.count,
        resetAtMs: freshCounter.resetAtMs,
        source: "memory",
      };
    }

    existing.count += 1;
    this.counters.set(key, existing);

    return {
      count: existing.count,
      resetAtMs: existing.resetAtMs,
      source: "memory",
    };
  }
}

type UpstashPipelineResult = {
  result?: unknown;
  error?: string;
};

class UpstashRateLimitStore implements RateLimitStore {
  readonly kind: RateLimitStoreKind = "upstash-with-memory-fallback";

  private readonly baseUrl: string;

  private readonly token: string;

  private readonly fallbackStore: InMemoryRateLimitStore;

  private lastWarningAt = 0;

  constructor(baseUrl: string, token: string, fallbackStore: InMemoryRateLimitStore) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
    this.fallbackStore = fallbackStore;
  }

  private toNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return Number.NaN;
  }

  private maybeWarn(message: string, details?: unknown): void {
    const now = Date.now();
    if (now - this.lastWarningAt < 30_000) {
      return;
    }
    this.lastWarningAt = now;
    console.warn(message, details);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitIncrementResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_500);

    try {
      const response = await fetch(`${this.baseUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, windowMs, "NX"],
          ["PTTL", key],
        ]),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Upstash rate-limit request failed (${response.status})`);
      }

      const payload = (await response.json()) as UpstashPipelineResult[];
      if (!Array.isArray(payload) || payload.length < 3) {
        throw new Error("Upstash rate-limit response shape is invalid");
      }
      const firstError = payload.find((entry) => typeof entry?.error === "string");
      if (firstError?.error) {
        throw new Error(firstError.error);
      }

      const count = this.toNumber(payload[0]?.result);
      const ttlMsRaw = this.toNumber(payload[2]?.result);
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error("Upstash rate-limit counter is invalid");
      }
      const ttlMs = Number.isFinite(ttlMsRaw) && ttlMsRaw > 0 ? ttlMsRaw : windowMs;

      return {
        count: Math.floor(count),
        resetAtMs: Date.now() + Math.floor(ttlMs),
        source: "upstash",
      };
    } catch (error: unknown) {
      this.maybeWarn("Upstash rate-limit backend unavailable. Falling back to memory store.", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      const fallbackResult = await this.fallbackStore.increment(key, windowMs);
      return {
        ...fallbackResult,
        source: "fallback-memory",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createRateLimitStore(): RateLimitStore {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (upstashUrl && upstashToken) {
    return new UpstashRateLimitStore(upstashUrl, upstashToken, new InMemoryRateLimitStore("memory"));
  }

  // Local/dev fallback with no external dependency. Non-distributed by design.
  return new InMemoryRateLimitStore("memory");
}

