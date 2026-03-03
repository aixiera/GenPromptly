import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { error, success } from "../../../lib/api/response";
import { CreateProjectSchema } from "../../../lib/validation/project";

export const runtime = "nodejs";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(success(projects), { status: 200 });
  } catch {
    return NextResponse.json(
      error("INTERNAL_ERROR", "Failed to fetch projects"),
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      error("BAD_REQUEST", "Invalid JSON body"),
      { status: 400 }
    );
  }

  const parsed = CreateProjectSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        orgId: parsed.data.orgId,
      },
    });

    return NextResponse.json(success(project), { status: 201 });
  } catch {
    return NextResponse.json(
      error("INTERNAL_ERROR", "Failed to create project"),
      { status: 500 }
    );
  }
}
