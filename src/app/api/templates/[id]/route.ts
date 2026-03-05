import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../lib/db";
import { error, success } from "../../../../lib/api/response";

export const runtime = "nodejs";

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

const TemplateIdSchema = z.string().cuid();

function parseTemplateId(id: string) {
  return TemplateIdSchema.safeParse(id);
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const parsedId = parseTemplateId(id);

  if (!parsedId.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid template id", parsedId.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const template = await prisma.template.findUnique({
      where: { id: parsedId.data },
    });

    if (!template) {
      return NextResponse.json(error("NOT_FOUND", "Template not found"), { status: 404 });
    }

    return NextResponse.json(success(template), { status: 200 });
  } catch {
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch template"), { status: 500 });
  }
}
