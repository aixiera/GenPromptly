import { NextResponse } from "next/server";
import prisma from "GenPromptly/lib/db";
import { error, success } from "GenPromptly/lib/api/response";
import { CreatePromptSchema } from "GenPromptly/lib/validation/prompt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsed = CreatePromptSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
    }

    const prompt = await prisma.prompt.create({
      data: parsed.data,
    });

    return NextResponse.json(success(prompt), { status: 201 });
  } catch {
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create prompt"), { status: 500 });
  }
}
