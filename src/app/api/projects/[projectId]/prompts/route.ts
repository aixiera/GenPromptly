import { NextResponse } from "next/server";
import { z } from "zod";
import { error, success } from "../../../../../lib/api/response";
import { HttpError } from "../../../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../../lib/auth/server";
import { requirePermission } from "../../../../../lib/rbac";
import { getProjectById, listPromptsByProject } from "../../../../../lib/tenantData";

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
    requirePermission(auth, "view_prompt");

    const project = await getProjectById(auth.orgId, parsedId.data);
    if (!project) {
      return NextResponse.json(error("NOT_FOUND", "Project not found"), { status: 404 });
    }

    const prompts = await listPromptsByProject(auth.orgId, parsedId.data);
    return NextResponse.json(success(prompts), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.projects.prompts.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.projects.prompts.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch prompts"), { status: 500 });
  }
}
