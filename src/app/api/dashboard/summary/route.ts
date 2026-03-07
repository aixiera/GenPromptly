import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { HttpError } from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../lib/auth/server";
import { requirePermission } from "../../../../lib/rbac";

export const runtime = "nodejs";

const WINDOW_DAYS = 7;

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

function calculatePercentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
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

export async function GET(req: Request) {
  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "view_project");

    const { currentStart, currentEnd, previousStart, previousEnd } = getAnalysisWindows();

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
      usageCostAll,
      usageCostCurrentWindow,
      usageCostPreviousWindow,
    ] = await Promise.all([
      prisma.project.count({ where: { orgId: auth.orgId } }),
      prisma.prompt.count({ where: { orgId: auth.orgId } }),
      prisma.promptVersion.count({ where: { orgId: auth.orgId } }),
      prisma.prompt.count({
        where: { orgId: auth.orgId, createdAt: { gte: currentStart, lt: currentEnd } },
      }),
      prisma.prompt.count({
        where: { orgId: auth.orgId, createdAt: { gte: previousStart, lt: previousEnd } },
      }),
      prisma.promptVersion.count({
        where: { orgId: auth.orgId, createdAt: { gte: currentStart, lt: currentEnd } },
      }),
      prisma.promptVersion.count({
        where: { orgId: auth.orgId, createdAt: { gte: previousStart, lt: previousEnd } },
      }),
      prisma.promptVersion.findMany({
        where: { orgId: auth.orgId },
        select: { riskFlags: true },
      }),
      prisma.promptVersion.findMany({
        where: { orgId: auth.orgId, createdAt: { gte: currentStart, lt: currentEnd } },
        select: { riskFlags: true },
      }),
      prisma.promptVersion.findMany({
        where: { orgId: auth.orgId, createdAt: { gte: previousStart, lt: previousEnd } },
        select: { riskFlags: true },
      }),
      prisma.usage.aggregate({
        where: { orgId: auth.orgId },
        _sum: { costUsd: true },
      }),
      prisma.usage.aggregate({
        where: { orgId: auth.orgId, createdAt: { gte: currentStart, lt: currentEnd } },
        _sum: { costUsd: true },
      }),
      prisma.usage.aggregate({
        where: { orgId: auth.orgId, createdAt: { gte: previousStart, lt: previousEnd } },
        _sum: { costUsd: true },
      }),
    ]);

    const promptDeltaPct = calculatePercentChange(promptCountCurrentWindow, promptCountPreviousWindow);
    const optimizeDeltaPct = calculatePercentChange(optimizeCountCurrentWindow, optimizeCountPreviousWindow);

    const compliancePassRateAll = calculatePassRate(complianceRowsAll);
    const compliancePassRateCurrent = calculatePassRate(complianceRowsCurrentWindow);
    const compliancePassRatePrevious = calculatePassRate(complianceRowsPreviousWindow);
    const complianceDeltaPct =
      compliancePassRateCurrent !== null && compliancePassRatePrevious !== null
        ? calculatePercentChange(compliancePassRateCurrent, compliancePassRatePrevious)
        : null;

    const modelCostTotalUsd = toNumber(Number(usageCostAll._sum.costUsd ?? 0));
    const modelCostCurrentUsd = toNumber(Number(usageCostCurrentWindow._sum.costUsd ?? 0));
    const modelCostPreviousUsd = toNumber(Number(usageCostPreviousWindow._sum.costUsd ?? 0));
    const modelCostDeltaPct = calculatePercentChange(modelCostCurrentUsd, modelCostPreviousUsd);

    return NextResponse.json(
      success({
        windowDays: WINDOW_DAYS,
        projectCount,
        promptCount,
        versionCount,
        metrics: {
          promptsCount: { value: promptCount, deltaPct: promptDeltaPct },
          optimizeCount: { value: versionCount, deltaPct: optimizeDeltaPct },
          compliancePassRate: { value: compliancePassRateAll, deltaPct: complianceDeltaPct },
          modelCostUsd: { value: modelCostTotalUsd, deltaPct: modelCostDeltaPct },
        },
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.dashboard.summary.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.dashboard.summary.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch dashboard summary"), { status: 500 });
  }
}
