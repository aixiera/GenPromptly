import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../../../lib/db";
import { HttpError } from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../lib/auth/server";
import { requirePermission } from "../../../../lib/rbac";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../../lib/security/rateLimit";

export const runtime = "nodejs";

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

const TemplateIdSchema = z.string().cuid();
const UpdateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(1000).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    inputSchema: z.unknown().optional(),
    systemPrompt: z.string().trim().min(1).max(40000).optional(),
  })
  .strict()
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.category !== undefined ||
      payload.inputSchema !== undefined ||
      payload.systemPrompt !== undefined,
    { message: "At least one field must be provided" }
  );

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const parsedId = TemplateIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid template id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "view_template");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "readHeavy",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "template-detail",
      },
      "api.templates.id.get"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const template = await prisma.template.findUnique({ where: { id: parsedId.data } });
    if (!template) {
      return NextResponse.json(error("NOT_FOUND", "Template not found"), { status: 404 });
    }
    return NextResponse.json(success(template), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.templates.id.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.templates.id.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch template"), { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const bodyTooLarge = enforceRequestBodyLimit(req, 120_000, "api.templates.id.patch");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  const { id } = await ctx.params;
  const parsedId = TemplateIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid template id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = UpdateTemplateSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "update_template");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "writeMutation",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "update-template",
      },
      "api.templates.id.patch"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const existing = await prisma.template.findUnique({
      where: { id: parsedId.data },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Template not found"), { status: 404 });
    }

    const updateData: Prisma.TemplateUpdateInput = {
      ...(parsedBody.data.name !== undefined ? { name: parsedBody.data.name } : {}),
      ...(parsedBody.data.description !== undefined ? { description: parsedBody.data.description } : {}),
      ...(parsedBody.data.category !== undefined ? { category: parsedBody.data.category } : {}),
      ...(parsedBody.data.systemPrompt !== undefined ? { systemPrompt: parsedBody.data.systemPrompt } : {}),
      ...(parsedBody.data.inputSchema !== undefined
        ? { inputSchema: parsedBody.data.inputSchema as Prisma.InputJsonValue }
        : {}),
    };

    const updated = await prisma.template.update({
      where: { id: parsedId.data },
      data: updateData,
    });
    return NextResponse.json(success(updated), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.templates.id.patch");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.templates.id.patch", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to update template"), { status: 500 });
  }
}
