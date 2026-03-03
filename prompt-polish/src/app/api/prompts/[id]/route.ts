import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { error, success } from "../../../../lib/api/response";
import {
  CreatePromptSchema,
  UpdatePromptSchema,
} from "../../../../lib/validation/prompt";

export const runtime = "nodejs";

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

function parsePromptId(id: string) {
  return CreatePromptSchema.shape.projectId.safeParse(id);
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const parsedId = parsePromptId(id);

  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: parsedId.data },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!prompt) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    return NextResponse.json(success(prompt), { status: 200 });
  } catch {
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch prompt"), { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const parsedId = parsePromptId(id);

  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = UpdatePromptSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.prompt.findUnique({
      where: { id: parsedId.data },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    const updatedPrompt = await prisma.prompt.update({
      where: { id: parsedId.data },
      data: parsedBody.data,
    });

    return NextResponse.json(success(updatedPrompt), { status: 200 });
  } catch {
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to update prompt"), { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const parsedId = parsePromptId(id);

  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const existing = await prisma.prompt.findUnique({
      where: { id: parsedId.data },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    await prisma.$transaction([
      prisma.promptVersion.deleteMany({
        where: { promptId: parsedId.data },
      }),
      prisma.prompt.delete({
        where: { id: parsedId.data },
      }),
    ]);

    return NextResponse.json(success({ id: parsedId.data }), { status: 200 });
  } catch {
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to delete prompt"), { status: 500 });
  }
}
