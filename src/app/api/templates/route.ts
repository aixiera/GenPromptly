import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { error, success } from "../../../lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(success(templates), { status: 200 });
  } catch {
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch templates"), { status: 500 });
  }
}
