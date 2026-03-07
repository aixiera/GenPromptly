import type { PlanTier, Prisma, UserPlan } from "@prisma/client";
import prisma from "../db";
import { FREE_OPTIMIZE_LIMIT } from "./constants";

export type PlanWriter = Prisma.TransactionClient | typeof prisma;

const PLUS_ACTIVE_STATUSES = new Set(["active", "trialing"]);

function normalizeSubscriptionStatus(status: string | null | undefined): string | null {
  if (!status) {
    return null;
  }
  return status.trim().toLowerCase() || null;
}

export function isPlusSubscriptionStatusActive(status: string | null | undefined): boolean {
  const normalized = normalizeSubscriptionStatus(status);
  if (!normalized) {
    return false;
  }
  return PLUS_ACTIVE_STATUSES.has(normalized);
}

export function isUserPlanPlusActive(
  userPlan: Pick<UserPlan, "plan" | "subscriptionStatus" | "currentPeriodEnd">,
  now = new Date()
): boolean {
  if (userPlan.plan !== "PLUS") {
    return false;
  }
  if (!isPlusSubscriptionStatusActive(userPlan.subscriptionStatus)) {
    return false;
  }
  if (!userPlan.currentPeriodEnd) {
    return true;
  }
  return userPlan.currentPeriodEnd.getTime() > now.getTime();
}

export function getFreeOptimizeRemaining(freeOptimizeUsed: number): number {
  const used = Number.isFinite(freeOptimizeUsed) ? Math.max(0, Math.floor(freeOptimizeUsed)) : 0;
  return Math.max(0, FREE_OPTIMIZE_LIMIT - used);
}

export async function getOrCreateUserPlan(
  userId: string,
  writer: PlanWriter = prisma
): Promise<UserPlan> {
  return writer.userPlan.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      plan: "FREE",
    },
  });
}

export type BillingSnapshot = {
  recordedPlan: PlanTier;
  effectivePlan: PlanTier;
  isPlusActive: boolean;
  freeOptimizeUsed: number;
  freeOptimizeRemaining: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
};

export function toBillingSnapshot(userPlan: UserPlan, now = new Date()): BillingSnapshot {
  const isPlusActive = isUserPlanPlusActive(userPlan, now);
  return {
    recordedPlan: userPlan.plan,
    effectivePlan: isPlusActive ? "PLUS" : "FREE",
    isPlusActive,
    freeOptimizeUsed: userPlan.freeOptimizeUsed,
    freeOptimizeRemaining: getFreeOptimizeRemaining(userPlan.freeOptimizeUsed),
    stripeCustomerId: userPlan.stripeCustomerId ?? null,
    stripeSubscriptionId: userPlan.stripeSubscriptionId ?? null,
    subscriptionStatus: userPlan.subscriptionStatus ?? null,
    currentPeriodEnd: userPlan.currentPeriodEnd ?? null,
  };
}

export type OptimizeAccessDecision = {
  userPlan: UserPlan;
  allowOptimize: boolean;
  requiresUpgrade: boolean;
  isPlusActive: boolean;
  freeOptimizeUsed: number;
  freeOptimizeRemaining: number;
};

export async function getOptimizeAccessDecision(
  userId: string,
  writer: PlanWriter = prisma
): Promise<OptimizeAccessDecision> {
  const userPlan = await getOrCreateUserPlan(userId, writer);
  const isPlusActive = isUserPlanPlusActive(userPlan);
  const freeOptimizeRemaining = getFreeOptimizeRemaining(userPlan.freeOptimizeUsed);

  if (isPlusActive) {
    return {
      userPlan,
      allowOptimize: true,
      requiresUpgrade: false,
      isPlusActive: true,
      freeOptimizeUsed: userPlan.freeOptimizeUsed,
      freeOptimizeRemaining,
    };
  }

  const allowOptimize = freeOptimizeRemaining > 0;
  return {
    userPlan,
    allowOptimize,
    requiresUpgrade: !allowOptimize,
    isPlusActive: false,
    freeOptimizeUsed: userPlan.freeOptimizeUsed,
    freeOptimizeRemaining,
  };
}

export async function consumeFreeOptimizeQuotaIfAvailable(
  userId: string,
  writer: PlanWriter = prisma
): Promise<boolean> {
  await getOrCreateUserPlan(userId, writer);
  const result = await writer.userPlan.updateMany({
    where: {
      userId,
      freeOptimizeUsed: {
        lt: FREE_OPTIMIZE_LIMIT,
      },
    },
    data: {
      plan: "FREE",
      freeOptimizeUsed: {
        increment: 1,
      },
    },
  });
  return result.count === 1;
}
