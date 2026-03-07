import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { HttpError } from "../../../lib/api/httpError";
import { error, success } from "../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../lib/auth/server";
import { requirePermission } from "../../../lib/rbac";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "view_template");

    const templates = await prisma.template.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(success(templates), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.templates.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.templates.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch templates"), { status: 500 });
  }
}
