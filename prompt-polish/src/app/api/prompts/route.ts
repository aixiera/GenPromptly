import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { HttpError } from "../../../lib/api/httpError";
import { error, success } from "../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../lib/auth/server";
import { logAuditEvent, getRequestAuditContext } from "../../../lib/audit";
import { CreatePromptSchema } from "../../../lib/validation/prompt";
import { requirePermission } from "../../../lib/rbac";
import { getProjectById } from "../../../lib/tenantData";
import { getSkillByTemplateKey } from "../../../lib/tools/toolRegistry";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../lib/security/rateLimit";

export const runtime = "nodejs";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function deriveRecentOptimizeStatus(version: { riskFlags: unknown; missingFields: unknown } | null) {
  if (!version) {
    return "NOT_RUN" as const;
  }

  const riskFlags = asStringArray(version.riskFlags);
  const missingFields = asStringArray(version.missingFields);
  if (riskFlags.length > 0 || missingFields.length > 0) {
    return "WARN" as const;
  }
  return "PASS" as const;
}

export async function GET(req: Request) {
  try {
    const ctx = await requireAuthContext(req);
    requirePermission(ctx, "view_prompt");

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId")?.trim() || null;
    const rateLimitDecision = await enforceRateLimit(
      req,
      "readHeavy",
      {
        userId: ctx.userId,
        orgId: ctx.orgId,
        action: projectId ? "list-prompts-by-project" : "list-prompts",
      },
      "api.prompts.get"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }
    if (projectId) {
      const project = await getProjectById(ctx.orgId, projectId);
      if (!project) {
        return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
      }
    }

    const prompts = await prisma.prompt.findMany({
      where: {
        orgId: ctx.orgId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        orgId: true,
        projectId: true,
        templateId: true,
        title: true,
        rawPrompt: true,
        createdAt: true,
        updatedAt: true,
        template: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            versions: true,
          },
        },
        versions: {
          where: {
            orgId: ctx.orgId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            riskFlags: true,
            missingFields: true,
          },
        },
      },
    });

    const payload = prompts.map((prompt) => {
      const latestVersion = prompt.versions[0] ?? null;
      return {
        id: prompt.id,
        orgId: prompt.orgId,
        projectId: prompt.projectId,
        templateId: prompt.templateId,
        title: prompt.title,
        rawPrompt: prompt.rawPrompt,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        project: prompt.project,
        template: prompt.template,
        versionCount: prompt._count.versions,
        latestOptimizeAt: latestVersion?.createdAt ?? null,
        recentOptimizeStatus: deriveRecentOptimizeStatus(latestVersion),
      };
    });

    return NextResponse.json(success(payload), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.prompts.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch prompts"), { status: 500 });
  }
}

export async function POST(req: Request) {
  const bodyTooLarge = enforceRequestBodyLimit(req, 64_000, "api.prompts.post");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsed = CreatePromptSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten()), {
      status: 400,
    });
  }

  try {
    const ctx = await requireAuthContext(req);
    requirePermission(ctx, "create_prompt");
    const auditCtx = getRequestAuditContext(req);
    const rateLimitDecision = await enforceRateLimit(
      req,
      "writeMutation",
      {
        userId: ctx.userId,
        orgId: ctx.orgId,
        action: "create-prompt",
      },
      "api.prompts.post"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const project = await getProjectById(ctx.orgId, parsed.data.projectId);
    if (!project) {
      return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
    }

    let selectedTemplateKey: string | null = null;
    if (parsed.data.templateId) {
      const template = await prisma.template.findUnique({
        where: { id: parsed.data.templateId },
        select: { id: true, key: true },
      });
      if (!template) {
        return NextResponse.json(error("NOT_FOUND", "Template not found"), { status: 404 });
      }
      selectedTemplateKey = template.key;
    }

    const prompt = await prisma.$transaction(async (tx) => {
      const createdPrompt = await tx.prompt.create({
        data: {
          projectId: parsed.data.projectId,
          orgId: ctx.orgId,
          templateId: parsed.data.templateId,
          title: parsed.data.title,
          rawPrompt: parsed.data.rawPrompt,
        },
      });

      await logAuditEvent(tx, {
        orgId: ctx.orgId,
        userId: ctx.userId,
        action: "CREATE_PROMPT",
        resourceType: "Prompt",
        resourceId: createdPrompt.id,
        metadata: {
          projectId: createdPrompt.projectId,
          templateId: createdPrompt.templateId,
          templateKey: selectedTemplateKey,
          skillKey: getSkillByTemplateKey(selectedTemplateKey)?.skillKey ?? null,
        },
        ...auditCtx,
      });

      return createdPrompt;
    });

    return NextResponse.json(success(prompt), { status: 201 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.prompts.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create prompt"), { status: 500 });
  }
}
