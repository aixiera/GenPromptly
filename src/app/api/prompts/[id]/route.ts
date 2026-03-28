import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../lib/db";
import { HttpError, NotFoundError } from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../lib/auth/server";
import { logAuditEvent, getRequestAuditContext } from "../../../../lib/audit";
import { UpdatePromptSchema } from "../../../../lib/validation/prompt";
import { requirePermission } from "../../../../lib/rbac";
import { getPromptById, getPromptWithVersions } from "../../../../lib/tenantData";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../../lib/security/rateLimit";

export const runtime = "nodejs";

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

const PromptIdSchema = z.string().trim().min(1, "id is required").max(120);

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const parsedId = PromptIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "view_prompt");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "readHeavy",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "prompt-detail",
      },
      "api.prompts.id.get"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const prompt = await getPromptWithVersions(auth.orgId, parsedId.data);
    if (!prompt) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    return NextResponse.json(success(prompt), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.prompts.id.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.id.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch prompt"), { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const bodyTooLarge = enforceRequestBodyLimit(req, 64_000, "api.prompts.id.patch");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  const { id } = await ctx.params;
  const parsedId = PromptIdSchema.safeParse(id);
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
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "update_prompt");
    const auditCtx = getRequestAuditContext(req);
    const rateLimitDecision = await enforceRateLimit(
      req,
      "writeMutation",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "update-prompt",
      },
      "api.prompts.id.patch"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const existing = await getPromptById(auth.orgId, parsedId.data);
    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    const updatedPrompt = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.prompt.updateMany({
        where: {
          id: parsedId.data,
          orgId: auth.orgId,
        },
        data: parsedBody.data,
      });
      if (updatedCount.count === 0) {
        throw new NotFoundError("Prompt not found");
      }

      const updated = await tx.prompt.findFirst({
        where: {
          id: parsedId.data,
          orgId: auth.orgId,
        },
      });
      if (!updated) {
        throw new NotFoundError("Prompt not found");
      }

      await logAuditEvent(tx, {
        orgId: auth.orgId,
        userId: auth.userId,
        action: "UPDATE_PROMPT",
        resourceType: "Prompt",
        resourceId: updated.id,
        metadata: {
          previousTitle: existing.title,
          nextTitle: updated.title,
          rawPromptChanged:
            parsedBody.data.rawPrompt !== undefined && parsedBody.data.rawPrompt !== existing.rawPrompt,
        },
        ...auditCtx,
      });

      return updated;
    });

    return NextResponse.json(success(updatedPrompt), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.prompts.id.patch");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.id.patch", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to update prompt"), { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const parsedId = PromptIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "delete_prompt");
    const auditCtx = getRequestAuditContext(req);
    const rateLimitDecision = await enforceRateLimit(
      req,
      "writeMutation",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "delete-prompt",
      },
      "api.prompts.id.delete"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const existing = await getPromptById(auth.orgId, parsedId.data);
    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.promptVersion.deleteMany({
        where: {
          promptId: parsedId.data,
          orgId: auth.orgId,
        },
      });

      const deleted = await tx.prompt.deleteMany({
        where: {
          id: parsedId.data,
          orgId: auth.orgId,
        },
      });
      if (deleted.count === 0) {
        throw new NotFoundError("Prompt not found");
      }

      await logAuditEvent(tx, {
        orgId: auth.orgId,
        userId: auth.userId,
        action: "DELETE_PROMPT",
        resourceType: "Prompt",
        resourceId: parsedId.data,
        metadata: {
          title: existing.title,
          projectId: existing.projectId,
        },
        ...auditCtx,
      });
    });

    return NextResponse.json(success({ id: parsedId.data }), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.prompts.id.delete");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.id.delete", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to delete prompt"), { status: 500 });
  }
}
