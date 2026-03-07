import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { error, success } from "../../../lib/api/response";
import { HttpError } from "../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../lib/auth/server";
import { logAuditEvent, getRequestAuditContext } from "../../../lib/audit";
import { CreateProjectSchema } from "../../../lib/validation/project";
import { requirePermission } from "../../../lib/rbac";
import { listProjects } from "../../../lib/tenantData";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuthContext(req);
    requirePermission(ctx, "view_project");

    const projects = await listProjects(ctx.orgId);
    return NextResponse.json(success(projects), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.projects.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.projects.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch projects"), { status: 500 });
  }
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten()), {
      status: 400,
    });
  }

  try {
    const ctx = await requireAuthContext(req);
    requirePermission(ctx, "create_project");
    const auditCtx = getRequestAuditContext(req);

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name: parsed.data.name,
          orgId: ctx.orgId,
        },
      });

      await logAuditEvent(tx, {
        orgId: ctx.orgId,
        userId: ctx.userId,
        action: "CREATE_PROJECT",
        resourceType: "Project",
        resourceId: createdProject.id,
        metadata: {
          projectName: createdProject.name,
        },
        ...auditCtx,
      });

      return createdProject;
    });

    return NextResponse.json(success(project), { status: 201 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.projects.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.projects.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create project"), { status: 500 });
  }
}
