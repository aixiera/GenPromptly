import { NextResponse } from "next/server";
import prisma from "GenPromptly/lib/db";
import { error, success } from "GenPromptly/lib/api/response";

export const runtime = "nodejs";

function getTodayUtcRange() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

export async function GET() {
  try {
    const { start, end } = getTodayUtcRange();

    const [projectCount, promptCount, versionCount, usageAgg] = await prisma.$transaction([
      prisma.project.count(),
      prisma.prompt.count(),
      prisma.promptVersion.count(),
      prisma.usage.aggregate({
        where: {
          date: {
            gte: start,
            lt: end,
          },
        },
        _sum: {
          optimizeCount: true,
        },
      }),
    ]);

    return NextResponse.json(
      success({
        projectCount,
        promptCount,
        versionCount,
        optimizeCountToday: usageAgg._sum.optimizeCount ?? 0,
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
