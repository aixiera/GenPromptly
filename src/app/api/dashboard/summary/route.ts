import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { error, success } from "../../../../lib/api/response";

export const runtime = "nodejs";

const WINDOW_DAYS = 7;
const DEFAULT_INPUT_COST_PER_MILLION_USD = 0.4;
const DEFAULT_OUTPUT_COST_PER_MILLION_USD = 1.6;

type RiskFlagsRow = {
  riskFlags: unknown;
};

function getAnalysisWindows() {
  const now = new Date();
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - WINDOW_DAYS);

  const previousEnd = new Date(currentStart);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - WINDOW_DAYS);

  return { currentStart, currentEnd, previousStart, previousEnd };
}

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toRate(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function readCostRate(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toTokenSums(source: { tokenIn?: number | null; tokenOut?: number | null }) {
  return {
    tokenIn: toNumber(source.tokenIn),
    tokenOut: toNumber(source.tokenOut),
  };
}

function toUsdCost(tokenIn: number, tokenOut: number, inputRate: number, outputRate: number): number {
  return tokenIn / 1_000_000 * inputRate + tokenOut / 1_000_000 * outputRate;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function calculatePassRate(rows: RiskFlagsRow[]): number | null {
  if (rows.length === 0) {
    return null;
  }

  let passCount = 0;
  for (const row of rows) {
    const flags = isStringArray(row.riskFlags) ? row.riskFlags : ["InvalidRiskFlags"];
    if (flags.length === 0) {
      passCount += 1;
    }
  }

  return passCount / rows.length * 100;
}

export async function GET() {
  try {
    const { currentStart, currentEnd, previousStart, previousEnd } = getAnalysisWindows();
    const inputCostRate = readCostRate(
      process.env.MODEL_INPUT_COST_PER_MILLION_USD,
      DEFAULT_INPUT_COST_PER_MILLION_USD
    );
    const outputCostRate = readCostRate(
      process.env.MODEL_OUTPUT_COST_PER_MILLION_USD,
      DEFAULT_OUTPUT_COST_PER_MILLION_USD
    );

    const [
      projectCount,
      promptCount,
      versionCount,
      promptCountCurrentWindow,
      promptCountPreviousWindow,
      optimizeCountCurrentWindow,
      optimizeCountPreviousWindow,
      complianceRowsAll,
      complianceRowsCurrentWindow,
      complianceRowsPreviousWindow,
      usageRowCount,
      usageTokensAll,
      usageTokensCurrentWindow,
      usageTokensPreviousWindow,
      versionTokensAll,
      versionTokensCurrentWindow,
      versionTokensPreviousWindow,
    ] = await prisma.$transaction([
      prisma.project.count(),
      prisma.prompt.count(),
      prisma.promptVersion.count(),
      prisma.prompt.count({
        where: {
          createdAt: {
            gte: currentStart,
            lt: currentEnd,
          },
        },
      }),
      prisma.prompt.count({
        where: {
          createdAt: {
            gte: previousStart,
            lt: previousEnd,
          },
        },
      }),
      prisma.promptVersion.count({
        where: {
          createdAt: {
            gte: currentStart,
            lt: currentEnd,
          },
        },
      }),
      prisma.promptVersion.count({
        where: {
          createdAt: {
            gte: previousStart,
            lt: previousEnd,
          },
        },
      }),
      prisma.promptVersion.findMany({
        select: { riskFlags: true },
      }),
      prisma.promptVersion.findMany({
        where: {
          createdAt: {
            gte: currentStart,
            lt: currentEnd,
          },
        },
        select: { riskFlags: true },
      }),
      prisma.promptVersion.findMany({
        where: {
          createdAt: {
            gte: previousStart,
            lt: previousEnd,
          },
        },
        select: { riskFlags: true },
      }),
      prisma.usage.count(),
      prisma.usage.aggregate({
        _sum: {
          tokenIn: true,
          tokenOut: true,
        },
      }),
      prisma.usage.aggregate({
        where: {
          date: {
            gte: currentStart,
            lt: currentEnd,
          },
        },
        _sum: {
          tokenIn: true,
          tokenOut: true,
        },
      }),
      prisma.usage.aggregate({
        where: {
          date: {
            gte: previousStart,
            lt: previousEnd,
          },
        },
        _sum: {
          tokenIn: true,
          tokenOut: true,
        },
      }),
      prisma.promptVersion.aggregate({
        _sum: {
          tokenIn: true,
          tokenOut: true,
        },
      }),
      prisma.promptVersion.aggregate({
        where: {
          createdAt: {
            gte: currentStart,
            lt: currentEnd,
          },
        },
        _sum: {
          tokenIn: true,
          tokenOut: true,
        },
      }),
      prisma.promptVersion.aggregate({
        where: {
          createdAt: {
            gte: previousStart,
            lt: previousEnd,
          },
        },
        _sum: {
          tokenIn: true,
          tokenOut: true,
        },
      }),
    ]);

    const promptDeltaPct = calculatePercentChange(promptCountCurrentWindow, promptCountPreviousWindow);
    const optimizeDeltaPct = calculatePercentChange(optimizeCountCurrentWindow, optimizeCountPreviousWindow);

    const compliancePassRateAll = toRate(calculatePassRate(complianceRowsAll));
    const compliancePassRateCurrent = toRate(calculatePassRate(complianceRowsCurrentWindow));
    const compliancePassRatePrevious = toRate(calculatePassRate(complianceRowsPreviousWindow));
    const complianceDeltaPct =
      compliancePassRateCurrent !== null && compliancePassRatePrevious !== null
        ? calculatePercentChange(compliancePassRateCurrent, compliancePassRatePrevious)
        : null;

    const useUsageTokens = usageRowCount > 0;

    const totalTokens = useUsageTokens
      ? toTokenSums(usageTokensAll._sum)
      : toTokenSums(versionTokensAll._sum);
    const currentTokens = useUsageTokens
      ? toTokenSums(usageTokensCurrentWindow._sum)
      : toTokenSums(versionTokensCurrentWindow._sum);
    const previousTokens = useUsageTokens
      ? toTokenSums(usageTokensPreviousWindow._sum)
      : toTokenSums(versionTokensPreviousWindow._sum);

    const modelCostTotalUsd = toUsdCost(
      totalTokens.tokenIn,
      totalTokens.tokenOut,
      inputCostRate,
      outputCostRate
    );
    const modelCostCurrentUsd = toUsdCost(
      currentTokens.tokenIn,
      currentTokens.tokenOut,
      inputCostRate,
      outputCostRate
    );
    const modelCostPreviousUsd = toUsdCost(
      previousTokens.tokenIn,
      previousTokens.tokenOut,
      inputCostRate,
      outputCostRate
    );
    const modelCostDeltaPct = calculatePercentChange(modelCostCurrentUsd, modelCostPreviousUsd);

    return NextResponse.json(
      success({
        windowDays: WINDOW_DAYS,
        projectCount,
        promptCount,
        versionCount,
        metrics: {
          promptsCount: {
            value: promptCount,
            deltaPct: promptDeltaPct,
          },
          optimizeCount: {
            value: versionCount,
            deltaPct: optimizeDeltaPct,
          },
          compliancePassRate: {
            value: compliancePassRateAll,
            deltaPct: complianceDeltaPct,
          },
          modelCostUsd: {
            value: modelCostTotalUsd,
            deltaPct: modelCostDeltaPct,
          },
        },
      }),
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      error("INTERNAL_ERROR", "Failed to fetch dashboard summary"),
      { status: 500 }
    );
  }
}
