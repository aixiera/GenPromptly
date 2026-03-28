import { NextResponse } from "next/server";
import { error, success } from "../../../../../lib/api/response";
import { HttpError } from "../../../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../lib/api/errorDiagnostics";
import { requireAuthContextWithoutOrg } from "../../../../../lib/auth/server";
import { requirePermission } from "../../../../../lib/rbac";
import { OrganizationSlugSchema } from "../../../../../lib/validation/team";
import { enforceRateLimit } from "../../../../../lib/security/rateLimit";
import {
  buildComplianceReport,
  parseComplianceFramework,
  type ComplianceFramework,
} from "../../../../../lib/compliance";

export const runtime = "nodejs";

type RouteContext = {
  params: { orgSlug: string } | Promise<{ orgSlug: string }>;
};

function resolveMembershipBySlug(
  memberships: Array<{ id: string; role: "OWNER" | "ADMIN" | "MEMBER"; org: { id: string; slug: string } }>,
  orgSlug: string
) {
  return memberships.find((entry) => entry.org.slug === orgSlug) ?? null;
}

function parseRequestedFramework(url: URL): ComplianceFramework | null {
  const raw = url.searchParams.get("framework");
  if (!raw) {
    return null;
  }
  if (raw.length > 30) {
    throw new HttpError(400, "VALIDATION_ERROR", "Framework filter is too long");
  }

  const parsed = parseComplianceFramework(raw);
  if (!parsed) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid compliance framework filter", { framework: raw });
  }

  return parsed;
}

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { orgSlug } = await ctx.params;
    const parsedSlug = OrganizationSlugSchema.safeParse(orgSlug);
    if (!parsedSlug.success) {
      return NextResponse.json(error("VALIDATION_ERROR", "Invalid organization slug", parsedSlug.error.flatten()), {
        status: 400,
      });
    }
    const auth = await requireAuthContextWithoutOrg(req);
    const orgMembership = resolveMembershipBySlug(auth.memberships, parsedSlug.data);
    if (!orgMembership) {
      return NextResponse.json(error("NOT_FOUND", "Organization not found"), { status: 404 });
    }
    requirePermission({ ...auth, role: orgMembership.role }, "view_project");
    const framework = parseRequestedFramework(new URL(req.url));
    const rateLimitDecision = await enforceRateLimit(
      req,
      "complianceRead",
      {
        userId: auth.userId,
        orgId: orgMembership.org.id,
        action: framework ?? "all",
      },
      "api.orgs.compliance.get"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const report = await buildComplianceReport(orgMembership.org.id, { framework });

    return NextResponse.json(success(report), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.compliance.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.compliance.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to build compliance report"), { status: 500 });
  }
}
