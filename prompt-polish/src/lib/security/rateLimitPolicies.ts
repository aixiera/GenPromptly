export type RateLimitScope =
  | "ip"
  | "user"
  | "org"
  | "user_org"
  | "ip_user"
  | "ip_user_org";

export type RateLimitEnforcement = "hard" | "soft";

export type RateLimitRule = {
  windowMs: number;
  maxRequests: number;
  scope: RateLimitScope;
  enforcement: RateLimitEnforcement;
};

export type ConcurrencyRule = {
  maxConcurrent: number;
  scope: RateLimitScope;
};

export type RateLimitPolicy = {
  bucket: string;
  message: string;
  rules: RateLimitRule[];
  concurrency?: ConcurrencyRule;
};

export const RATE_LIMIT_POLICIES = {
  authSession: {
    bucket: "auth-session",
    message: "Too many auth/session requests. Please wait before retrying.",
    rules: [
      { windowMs: 60_000, maxRequests: 70, scope: "ip_user", enforcement: "hard" },
      { windowMs: 5 * 60_000, maxRequests: 240, scope: "ip", enforcement: "hard" },
    ],
  },
  readHeavy: {
    bucket: "read-heavy",
    message: "Too many dashboard/report requests. Please wait before retrying.",
    rules: [
      { windowMs: 10_000, maxRequests: 24, scope: "ip_user_org", enforcement: "hard" },
      { windowMs: 5 * 60_000, maxRequests: 260, scope: "user_org", enforcement: "soft" },
    ],
  },
  writeMutation: {
    bucket: "write-mutation",
    message: "Too many write requests. Please slow down and retry shortly.",
    rules: [
      { windowMs: 10_000, maxRequests: 12, scope: "ip_user", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 45, scope: "user_org", enforcement: "hard" },
    ],
  },
  orgSwitch: {
    bucket: "org-switch",
    message: "Too many workspace switches. Please wait before retrying.",
    rules: [
      { windowMs: 10_000, maxRequests: 8, scope: "ip_user", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 20, scope: "user", enforcement: "hard" },
    ],
  },
  optimizeCostly: {
    bucket: "optimize",
    message: "Optimize is temporarily rate limited. Please wait and retry.",
    rules: [
      { windowMs: 60_000, maxRequests: 8, scope: "user_org", enforcement: "hard" },
      { windowMs: 10 * 60_000, maxRequests: 40, scope: "user_org", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 12, scope: "ip_user", enforcement: "hard" },
    ],
    concurrency: {
      maxConcurrent: 2,
      scope: "user_org",
    },
  },
  improveCostly: {
    bucket: "improve",
    message: "Improve is temporarily rate limited. Please wait and retry.",
    rules: [
      { windowMs: 60_000, maxRequests: 6, scope: "user_org", enforcement: "hard" },
      { windowMs: 10 * 60_000, maxRequests: 30, scope: "user_org", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 10, scope: "ip_user", enforcement: "hard" },
    ],
    concurrency: {
      maxConcurrent: 2,
      scope: "user_org",
    },
  },
  inviteCreate: {
    bucket: "invite-create",
    message: "Too many invites created. Please wait before sending more.",
    rules: [
      { windowMs: 60_000, maxRequests: 6, scope: "user_org", enforcement: "hard" },
      { windowMs: 60 * 60_000, maxRequests: 40, scope: "org", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 10, scope: "ip_user", enforcement: "hard" },
    ],
    concurrency: {
      maxConcurrent: 1,
      scope: "user_org",
    },
  },
  inviteRevoke: {
    bucket: "invite-revoke",
    message: "Too many invite revocations. Please wait before retrying.",
    rules: [
      { windowMs: 10_000, maxRequests: 10, scope: "ip_user", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 25, scope: "user_org", enforcement: "hard" },
    ],
  },
  inviteAccept: {
    bucket: "invite-accept",
    message: "Too many invite attempts. Please wait before retrying.",
    rules: [
      { windowMs: 60_000, maxRequests: 8, scope: "ip", enforcement: "hard" },
      { windowMs: 10 * 60_000, maxRequests: 20, scope: "ip_user", enforcement: "hard" },
    ],
  },
  exportOperation: {
    bucket: "export",
    message: "Export is temporarily rate limited. Please wait before retrying.",
    rules: [
      { windowMs: 60_000, maxRequests: 10, scope: "user_org", enforcement: "hard" },
      { windowMs: 10 * 60_000, maxRequests: 40, scope: "user_org", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 15, scope: "ip_user", enforcement: "hard" },
    ],
    concurrency: {
      maxConcurrent: 1,
      scope: "user_org",
    },
  },
  complianceRead: {
    bucket: "compliance-read",
    message: "Too many compliance report requests. Please wait before retrying.",
    rules: [
      { windowMs: 10_000, maxRequests: 12, scope: "ip_user_org", enforcement: "hard" },
      { windowMs: 60_000, maxRequests: 30, scope: "user_org", enforcement: "hard" },
    ],
  },
  internalBenchmark: {
    bucket: "internal-benchmark",
    message: "Benchmark requests are temporarily rate limited.",
    rules: [
      { windowMs: 10 * 60_000, maxRequests: 2, scope: "user_org", enforcement: "hard" },
      { windowMs: 60 * 60_000, maxRequests: 6, scope: "org", enforcement: "hard" },
    ],
    concurrency: {
      maxConcurrent: 1,
      scope: "user_org",
    },
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export function getRateLimitPolicy(policy: RateLimitPolicyName): RateLimitPolicy {
  return RATE_LIMIT_POLICIES[policy];
}

