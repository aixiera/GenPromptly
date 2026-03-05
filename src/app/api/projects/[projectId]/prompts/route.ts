import { NextResponse } from "next/server";
import prisma from "../../../../../lib/db";
import { error, success } from "../../../../../lib/api/response";
import { CreatePromptSchema } from "../../../../../lib/validation/prompt";

export const runtime = "nodejs";

type RouteContext = {
  params: { projectId: string } | Promise<{ projectId: string }>;
};

function parseProjectId(projectId: string) {
  return CreatePromptSchema.shape.projectId.safeParse(projectId);
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { projectId } = await ctx.params;
  const parsedId = parseProjectId(projectId);

  if (!parsedId.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid project id", parsedId.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: parsedId.data },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
    }

    const prompts = await prisma.prompt.findMany({
      where: { projectId: parsedId.data },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(success(prompts), { status: 200 });
  } catch {
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch prompts"), { status: 500 });
  }
}
