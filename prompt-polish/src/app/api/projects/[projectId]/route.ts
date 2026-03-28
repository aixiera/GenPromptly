import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../lib/db";
import { HttpError, NotFoundError } from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../lib/auth/server";
import { requirePermission } from "../../../../lib/rbac";
import { getRequestAuditContext, logAuditEvent } from "../../../../lib/audit";
import { getProjectById } from "../../../../lib/tenantData";
import { UpdateProjectSchema } from "../../../../lib/validation/project";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../../lib/security/rateLimit";

export const runtime = "nodejs";

type RouteContext = {
  params: { projectId: string } | Promise<{ projectId: string }>;
};

const ProjectIdSchema = z.string().trim().min(1, "projectId is required").max(120);

export async function GET(req: Request, ctx: RouteContext) {
  const { projectId } = await ctx.params;
  const parsedId = ProjectIdSchema.safeParse(projectId);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid project id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "view_project");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "readHeavy",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "project-detail",
      },
      "api.projects.id.get"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const project = await getProjectById(auth.orgId, parsedId.data);
    if (!project) {
      return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
    }

    return NextResponse.json(success(project), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.projects.id.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.projects.id.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch project"), { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const bodyTooLarge = enforceRequestBodyLimit(req, 16_000, "api.projects.id.patch");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  const { projectId } = await ctx.params;
  const parsedId = ProjectIdSchema.safeParse(projectId);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid project id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = UpdateProjectSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "update_project");
    const auditCtx = getRequestAuditContext(req);
    const rateLimitDecision = await enforceRateLimit(
      req,
      "writeMutation",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "update-project",
      },
      "api.projects.id.patch"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const existing = await getProjectById(auth.orgId, parsedId.data);
    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const count = await tx.project.updateMany({
        where: {
          id: parsedId.data,
          orgId: auth.orgId,
        },
        data: {
          name: parsedBody.data.name,
        },
      });
      if (count.count === 0) {
        throw new NotFoundError("Project not found");
      }

      const project = await tx.project.findFirst({
        where: {
          id: parsedId.data,
          orgId: auth.orgId,
        },
      });
      if (!project) {
        throw new NotFoundError("Project not found");
      }

      await logAuditEvent(tx, {
        orgId: auth.orgId,
        userId: auth.userId,
        action: "UPDATE_PROJECT",
        resourceType: "Project",
        resourceId: project.id,
        metadata: {
          previousName: existing.name,
          nextName: project.name,
        },
        ...auditCtx,
      });

      return project;
    });

    return NextResponse.json(success(updated), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.projects.id.patch");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.projects.id.patch", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to update project"), { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { projectId } = await ctx.params;
  const parsedId = ProjectIdSchema.safeParse(projectId);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid project id", parsedId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "delete_project");
    const auditCtx = getRequestAuditContext(req);
    const rateLimitDecision = await enforceRateLimit(
      req,
      "writeMutation",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: "delete-project",
      },
      "api.projects.id.delete"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const existing = await getProjectById(auth.orgId, parsedId.data);
    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const promptCount = await tx.prompt.count({
        where: {
          orgId: auth.orgId,
          projectId: parsedId.data,
        },
      });

      const deleted = await tx.project.deleteMany({
        where: {
          id: parsedId.data,
          orgId: auth.orgId,
        },
      });
      if (deleted.count === 0) {
        throw new NotFoundError("Project not found");
      }

      await logAuditEvent(tx, {
        orgId: auth.orgId,
        userId: auth.userId,
        action: "DELETE_PROJECT",
        resourceType: "Project",
        resourceId: parsedId.data,
        metadata: {
          projectName: existing.name,
          promptCount,
        },
        ...auditCtx,
      });
    });

    return NextResponse.json(success({ id: parsedId.data }), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.projects.id.delete");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.projects.id.delete", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to delete project"), { status: 500 });
  }
}
