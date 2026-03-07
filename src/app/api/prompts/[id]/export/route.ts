import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../lib/db";
import { HttpError } from "../../../../../lib/api/httpError";
import { error, success } from "../../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../../lib/auth/server";
import { requirePermission } from "../../../../../lib/rbac";
import { getPromptWithVersions } from "../../../../../lib/tenantData";
import { getRequestAuditContext, logAuditEvent } from "../../../../../lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

const PromptIdSchema = z.string().trim().min(1).max(120);

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
    requirePermission(auth, "export_prompt");
    const auditCtx = getRequestAuditContext(req);

    const prompt = await getPromptWithVersions(auth.orgId, parsedId.data);
    if (!prompt) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    const latestVersion = prompt.versions[0] ?? null;
    const payload = {
      prompt: {
        id: prompt.id,
        title: prompt.title,
        rawPrompt: prompt.rawPrompt,
        projectId: prompt.projectId,
        templateId: prompt.templateId,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
      },
      latestVersion,
    };

    await prisma.$transaction(async (tx) => {
      await logAuditEvent(tx, {
        orgId: auth.orgId,
        userId: auth.userId,
        action: "EXPORT_PROMPT",
        resourceType: "Prompt",
        resourceId: prompt.id,
        metadata: {
          projectId: prompt.projectId,
          exportedLatestVersionId: latestVersion?.id ?? null,
        },
        ...auditCtx,
      });
    });

    return NextResponse.json(success(payload), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.prompts.export.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.export.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to export prompt"), { status: 500 });
  }
}
